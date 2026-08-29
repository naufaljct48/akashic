import { supabase } from './supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINT_FILE = path.resolve(process.cwd(), 'data/ingest-checkpoint.json');
const TARGET_TOTAL = 30000;
const PER_PAGE = 50; // Max AniList GraphQL perPage
const MAX_PAGES_PER_YEAR = 6; // 6 pages * 50 = 300 titles per year partition (well below AniList 5,000 limit)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BATCH_QUERY = `
query GetBatchComics(
  $page: Int,
  $perPage: Int,
  $countryOfOrigin: CountryCode,
  $startDate_greater: FuzzyDateInt,
  $startDate_lesser: FuzzyDateInt,
  $sort: [MediaSort]
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
      lastPage
    }
    media(
      type: MANGA,
      countryOfOrigin: $countryOfOrigin,
      startDate_greater: $startDate_greater,
      startDate_lesser: $startDate_lesser,
      sort: $sort
    ) {
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

interface CountryPartition {
  country: 'JP' | 'KR' | 'CN';
  label: string;
  startYear: number;
  endYear: number;
}

const PARTITIONS: CountryPartition[] = [
  { country: 'JP', label: 'Japanese Manga (1995-2026)', startYear: 1995, endYear: 2026 },
  { country: 'KR', label: 'Korean Manhwa (2000-2026)', startYear: 2000, endYear: 2026 },
  { country: 'CN', label: 'Chinese Manhua (2005-2026)', startYear: 2005, endYear: 2026 },
];

interface Checkpoint {
  partitionIndex: number;
  currentYear: number;
  currentPage: number;
  totalIngested: number;
  lastUpdated: string;
}

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const raw = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const cp = JSON.parse(raw);
      if (typeof cp.partitionIndex === 'number' && typeof cp.currentYear === 'number') {
        return cp;
      }
    }
  } catch (err) {
    console.warn('Could not read checkpoint, starting fresh.');
  }
  return {
    partitionIndex: 0,
    currentYear: PARTITIONS[0].startYear,
    currentPage: 1,
    totalIngested: 0,
    lastUpdated: new Date().toISOString(),
  };
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

async function fetchWithRetry(query: string, variables: any, maxRetries = 5): Promise<any> {
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
      const backoff = attempt * 3000;
      console.warn(`[Fetch Error] ${err.message}. Retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

async function startYearPartitionedIngestion() {
  console.log(`\n======================================================`);
  console.log(`🚀 AKASHIC DEX: YEAR-PARTITIONED INGESTION PIPELINE`);
  console.log(`🎯 Target: ${TARGET_TOTAL} titles (Rate Limit: 2.2s cooldown / ~27 req/min)`);
  console.log(`======================================================`);

  let checkpoint = loadCheckpoint();
  console.log(
    `Resuming from Partition: ${checkpoint.partitionIndex} (${PARTITIONS[checkpoint.partitionIndex]?.label ?? 'Done'}), Year: ${checkpoint.currentYear}, Page: ${checkpoint.currentPage}, Total Ingested: ${checkpoint.totalIngested}/${TARGET_TOTAL}`
  );

  for (let pIdx = checkpoint.partitionIndex; pIdx < PARTITIONS.length; pIdx++) {
    const part = PARTITIONS[pIdx];
    console.log(`\n📂 [Partition ${pIdx + 1}/${PARTITIONS.length}] ${part.label}`);

    const startYear = pIdx === checkpoint.partitionIndex ? checkpoint.currentYear : part.startYear;

    for (let year = startYear; year <= part.endYear; year++) {
      const startPage =
        pIdx === checkpoint.partitionIndex && year === checkpoint.currentYear
          ? checkpoint.currentPage
          : 1;

      console.log(`\n📅 --- Year ${year} (${part.country}) ---`);

      for (let page = startPage; page <= MAX_PAGES_PER_YEAR; page++) {
        if (checkpoint.totalIngested >= TARGET_TOTAL) {
          console.log(`\n🎯 Reached target ${TARGET_TOTAL} titles! Pipeline complete.`);
          return;
        }

        console.log(`  📄 Fetching Year ${year} Page ${page}/${MAX_PAGES_PER_YEAR}... [Total: ${checkpoint.totalIngested}]`);

        try {
          const startDate_greater = year * 10000;
          const startDate_lesser = (year + 1) * 10000;

          const json = await fetchWithRetry(BATCH_QUERY, {
            page,
            perPage: PER_PAGE,
            countryOfOrigin: part.country,
            startDate_greater,
            startDate_lesser,
            sort: ['POPULARITY_DESC', 'SCORE_DESC'],
          });

          const mediaList = json.data?.Page?.media || [];
          if (mediaList.length === 0) {
            console.log(`  End of results for Year ${year}.`);
            break;
          }

          const comicBatch: any[] = [];

          for (const item of mediaList) {
            const titleRomaji = item.title?.romaji || 'Unknown Title';
            const titleEnglish = item.title?.english || null;
            const baseSlug = slugify(titleEnglish || titleRomaji) || `comic-${item.id}`;

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
              slug: baseSlug,
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
              release_year: item.startDate?.year || year,
              average_score: item.averageScore || null,
              popularity: item.popularity || null,
              cover_image_url: item.coverImage?.extraLarge || item.coverImage?.large || null,
              banner_image_url: item.bannerImage || null,
              country_of_origin: item.countryOfOrigin || part.country,
              site_url: item.siteUrl || `https://anilist.co/manga/${item.id}`,
            };

            comicBatch.push(comicRecord);
          }

          // Upsert records one by one or in batch, with collision handling
          let savedInPage = 0;
          for (const record of comicBatch) {
            let { error: err } = await (supabase.from('comics') as any)
              .upsert(record, { onConflict: 'source_id' });

            if (err && err.message?.includes('comics_slug_key')) {
              // Slug collision with another source_id -> disambiguate slug
              record.slug = `${record.slug}-${record.source_id}`;
              const retry = await (supabase.from('comics') as any)
                .upsert(record, { onConflict: 'source_id' });
              err = retry.error;
            }

            if (err) {
              console.error(`    ❌ Error saving ${record.title_romaji} (${record.source_id}):`, err.message);
            } else {
              savedInPage++;
            }
          }

          checkpoint.totalIngested += savedInPage;
          console.log(`    ✅ Saved ${savedInPage}/${comicBatch.length} titles (Total Ingested: ${checkpoint.totalIngested})`);

          // Update Checkpoint
          checkpoint.partitionIndex = pIdx;
          checkpoint.currentYear = year;
          checkpoint.currentPage = page + 1;
          checkpoint.lastUpdated = new Date().toISOString();
          saveCheckpoint(checkpoint);

          const hasNext = json.data?.Page?.pageInfo?.hasNextPage;
          if (!hasNext) {
            console.log(`  No more pages for Year ${year}.`);
            break;
          }

          // AniList 30 req/min rate limit compliance: 2.2s sleep
          await sleep(2200);
        } catch (err: any) {
          console.error(`  Error processing Year ${year} Page ${page}:`, err?.message || err);
          await sleep(4000);
        }
      }

      // Reset page for next year
      checkpoint.currentYear = year + 1;
      checkpoint.currentPage = 1;
      saveCheckpoint(checkpoint);
    }

    // Advance partition
    checkpoint.partitionIndex = pIdx + 1;
    if (PARTITIONS[pIdx + 1]) {
      checkpoint.currentYear = PARTITIONS[pIdx + 1].startYear;
    }
    checkpoint.currentPage = 1;
    saveCheckpoint(checkpoint);
  }

  console.log(`\n🎉 Year-partitioned ingestion finished! Total titles processed: ${checkpoint.totalIngested}`);
}

startYearPartitionedIngestion().catch(console.error);
