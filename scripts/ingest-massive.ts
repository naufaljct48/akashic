import { supabase } from './supabase-admin';


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BATCH_QUERY = `
query GetBatchComics($page: Int, $perPage: Int, $countryOfOrigin: CountryCode, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
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


function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ingestBatch(label: string, countryOfOrigin: string | null, sort: string[], maxPages = 4) {
  console.log(`\n======================================================`);
  console.log(`📦 Ingesting Category: [${label}] (Up to ${maxPages * 25} titles)...`);
  console.log(`======================================================`);

  for (let page = 1; page <= maxPages; page++) {
    console.log(`Fetching Page ${page}...`);

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: BATCH_QUERY,
          variables: {
            page,
            perPage: 25,
            countryOfOrigin: countryOfOrigin || undefined,
            sort,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`AniList API returned status ${res.status}: ${res.statusText}`);
        break;
      }

      const json = await res.json();
      const mediaList = json.data?.Page?.media || [];

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

        // 1. Upsert comic record
        const { data: inserted, error: comicErr } = await (supabase.from('comics') as any)
          .upsert(comicRecord, { onConflict: 'source_id' })
          .select('id')
          .single();

        if (comicErr || !inserted) {
          continue;
        }


        console.log(`  ✓ [${type}] ${titleEnglish || titleRomaji} (Ch: ${comicRecord.total_chapters || 'Ongoing'}, Score: ${comicRecord.average_score || '-'})`);
      }

      console.log(`  ⏳ Cooldown 2.2s...`);
      await sleep(2200);
    } catch (err) {
      console.error(`Page ${page} failed:`, err);
    }
  }
}

async function runMassiveIngestion() {
  console.log('🚀 Starting Massive Akashic Dex Data Ingestion...');

  // 1. Top Korean Manhwa (4 pages = 100 Manhwa)
  await ingestBatch('Top Korean Manhwa', 'KR', ['POPULARITY_DESC', 'SCORE_DESC'], 4);

  // 2. Top Chinese Manhua (3 pages = 75 Manhua)
  await ingestBatch('Top Chinese Manhua', 'CN', ['POPULARITY_DESC', 'SCORE_DESC'], 3);

  // 3. Top Japanese Manga (4 pages = 100 Manga)
  await ingestBatch('Top Japanese Manga', 'JP', ['POPULARITY_DESC', 'SCORE_DESC'], 4);

  // 4. Currently Trending All Categories (3 pages = 75 Trending)
  await ingestBatch('Currently Trending Worldwide', null, ['TRENDING_DESC'], 3);

  console.log('\n🎉 Massive Ingestion Pipeline Finished Successfully!');
}

runMassiveIngestion().catch(console.error);
