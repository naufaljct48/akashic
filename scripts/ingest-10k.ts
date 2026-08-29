import { supabase } from './supabase-admin';
import * as fs from 'fs';
import * as path from 'path';


const CHECKPOINT_FILE = path.resolve(process.cwd(), 'data/ingest-checkpoint.json');
const TARGET_TOTAL = 10000;
const PER_PAGE = 50; // Max AniList GraphQL perPage

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BATCH_QUERY = `
query GetBatchComics($page: Int, $perPage: Int, $countryOfOrigin: CountryCode, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
      lastPage
    }
    media(type: MANGA, countryOfOrigin: $countryOfOrigin, sort: $sort) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      synonyms
      countryOfOrigin
      format
      status
      description(asHtml: false)
      chapters
      averageScore
      popularity
      startDate {
        year
      }
      genres
      tags {
        name
        rank
      }
      coverImage {
        extraLarge
        large
      }
      bannerImage
      siteUrl
    }
  }
}
`;

interface Checkpoint {
  categoryIndex: number;
  currentPage: number;
  totalIngested: number;
  lastUpdated: string;
}

const CATEGORIES = [
  { label: 'Top Popular Manhwa (Korea)', country: 'KR', sort: ['POPULARITY_DESC', 'SCORE_DESC'], maxPages: 60 },
  { label: 'Top Scored Manhwa (Korea)', country: 'KR', sort: ['SCORE_DESC', 'POPULARITY_DESC'], maxPages: 40 },
  { label: 'Top Popular Manga (Japan)', country: 'JP', sort: ['POPULARITY_DESC', 'SCORE_DESC'], maxPages: 60 },
  { label: 'Top Scored Manga (Japan)', country: 'JP', sort: ['SCORE_DESC', 'POPULARITY_DESC'], maxPages: 40 },
  { label: 'Top Popular Manhua (China)', country: 'CN', sort: ['POPULARITY_DESC', 'SCORE_DESC'], maxPages: 40 },
  { label: 'Top Scored Manhua (China)', country: 'CN', sort: ['SCORE_DESC', 'POPULARITY_DESC'], maxPages: 20 },
  { label: 'Trending Worldwide All Formats', country: null, sort: ['TRENDING_DESC', 'POPULARITY_DESC'], maxPages: 40 },
];

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const raw = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Could not read checkpoint, starting fresh.');
  }
  return { categoryIndex: 0, currentPage: 1, totalIngested: 0, lastUpdated: new Date().toISOString() };
}

function saveCheckpoint(cp: Checkpoint) {
  try {
    const dir = path.dirname(CHECKPOINT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write checkpoint file:', err);
  }
}


function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchWithRetry(query: string, variables: any, maxRetries = 4): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 60;
        console.warn(`[AniList 429 Rate Limit] Cooling down for ${retryAfter}s... (Attempt ${attempt}/${maxRetries})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      const backoff = attempt * 2000;
      console.warn(`[Fetch Error] ${err.message}. Retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

async function start10kIngestion() {
  console.log(`\n======================================================`);
  console.log(`🚀 AKASHIC DEX: 10,000 COMIC INGESTION PIPELINE`);
  console.log(`======================================================`);

  let checkpoint = loadCheckpoint();
  console.log(`Resuming from Category: ${checkpoint.categoryIndex}, Page: ${checkpoint.currentPage}, Ingested: ${checkpoint.totalIngested}/${TARGET_TOTAL}`);

  for (let cIdx = checkpoint.categoryIndex; cIdx < CATEGORIES.length; cIdx++) {
    const cat = CATEGORIES[cIdx];
    console.log(`\n📂 [Category ${cIdx + 1}/${CATEGORIES.length}] ${cat.label} (Max Pages: ${cat.maxPages})`);

    const startPage = cIdx === checkpoint.categoryIndex ? checkpoint.currentPage : 1;

    for (let page = startPage; page <= cat.maxPages; page++) {
      if (checkpoint.totalIngested >= TARGET_TOTAL) {
        console.log(`\n🎯 Reached target ${TARGET_TOTAL} titles! Pipeline complete.`);
        return;
      }

      console.log(`\n📄 Fetching Page ${page}/${cat.maxPages}... [Progress: ${checkpoint.totalIngested}/${TARGET_TOTAL} - ${((checkpoint.totalIngested / TARGET_TOTAL) * 100).toFixed(1)}%]`);

      try {
        const json = await fetchWithRetry(BATCH_QUERY, {
          page,
          perPage: PER_PAGE,
          countryOfOrigin: cat.country,
          sort: cat.sort,
        });

        const mediaList = json.data?.Page?.media || [];
        if (mediaList.length === 0) {
          console.log(`No more media in this category. Moving to next.`);
          break;
        }

        const comicBatch: any[] = [];

        for (const item of mediaList) {
          const titleRomaji = item.title?.romaji || 'Unknown Title';
          const titleEnglish = item.title?.english || null;
          const slug = slugify(titleEnglish || titleRomaji) || `comic-${item.id}`;

          const type =
            item.countryOfOrigin === 'KR'
              ? 'MANHWA'
              : item.countryOfOrigin === 'CN'
              ? 'MANHUA'
              : 'MANGA';

          const topTags =
            item.tags
              ?.filter((t: any) => t.rank >= 40)
              ?.slice(0, 8)
              ?.map((t: any) => t.name) || [];

          const comicRecord = {
            source_id: item.id,
            id_mal: item.idMal || null,
            slug,
            title_romaji: titleRomaji,
            title_english: titleEnglish,
            title_native: item.title?.native || null,
            synonyms: item.synonyms || [],
            type,
            format: item.format === 'ONE_SHOT' ? ('ONE_SHOT' as const) : ('MANGA' as const),
            status: item.status === 'FINISHED' ? ('FINISHED' as const) : ('RELEASING' as const),
            synopsis: item.description?.replace(/<[^>]*>?/gm, '') || null,
            genres: item.genres || [],
            tags: topTags,
            total_chapters: item.chapters || null,
            release_year: item.startDate?.year || null,
            average_score: item.averageScore || null,
            popularity: item.popularity || null,
            cover_image_url: item.coverImage?.extraLarge || item.coverImage?.large || null,
            banner_image_url: item.bannerImage || null,
            country_of_origin: item.countryOfOrigin || 'JP',
            site_url: item.siteUrl || `https://anilist.co/manga/${item.id}`,
          };

          comicBatch.push(comicRecord);
        }

        // Bulk Upsert Comics (50 at a time)
        const { data: insertedList, error: upsertErr } = await (supabase.from('comics') as any)
          .upsert(comicBatch, { onConflict: 'source_id' })
          .select('id, source_id, title_english, title_romaji, type, genres, tags, synopsis');

        if (upsertErr) {
          console.error(`[Supabase Upsert Error]:`, upsertErr.message);
        } else if (insertedList) {
          checkpoint.totalIngested += comicBatch.length;
          console.log(`  ✅ Successfully saved ${comicBatch.length} titles in batch (Total: ${checkpoint.totalIngested})`);
        }

        // Update Checkpoint
        checkpoint.currentPage = page + 1;
        checkpoint.lastUpdated = new Date().toISOString();
        saveCheckpoint(checkpoint);

        // Safe rate limit cooldown: ~1.2s between pages (AniList allows 90/min)
        await sleep(1200);
      } catch (err: any) {
        console.error(`Error processing page ${page}:`, err.message);
        await sleep(3000);
      }
    }

    // Advance category
    checkpoint.categoryIndex = cIdx + 1;
    checkpoint.currentPage = 1;
    saveCheckpoint(checkpoint);
  }

  console.log(`\n🎉 All categories finished! Total Ingested: ${checkpoint.totalIngested}`);
}

start10kIngestion().catch(console.error);
