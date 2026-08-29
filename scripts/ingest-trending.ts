import { supabase } from './supabase-admin';


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TRENDING_AND_NEW_QUERY = `
query GetTrendingAndNew($page: Int, $perPage: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
    }
    media(type: MANGA, sort: $sort) {
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

async function ingestBatch(sortType: string[], label: string, maxPages = 2) {
  console.log(`\n🚀 [Ingesting ${label}] Sort: ${sortType.join(', ')}`);

  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`Fetching page ${page}...`);
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: TRENDING_AND_NEW_QUERY,
          variables: { page, perPage: 25, sort: sortType },
        }),
      });

      if (!res.ok) {
        console.error(`AniList returned status ${res.status}`);
        break;
      }

      const json = await res.json();
      const mediaList = json.data?.Page?.media || [];

      for (const item of mediaList) {
        const titleRomaji = item.title?.romaji || 'Unknown Title';
        const titleEnglish = item.title?.english || null;
        const baseSlug = slugify(titleEnglish || titleRomaji) || 'comic';
        const slug = `${baseSlug}-${item.id}`;

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

        const { data: inserted, error: comicErr } = await (supabase.from('comics') as any)
          .upsert(comicRecord, { onConflict: 'source_id' })
          .select('*')
          .single();

        if (comicErr) {
          console.error(`Error saving ${titleEnglish || titleRomaji}:`, comicErr.message);
          continue;
        }

        if (inserted) {

          console.log(`  ✓ Synced: ${titleEnglish || titleRomaji} (${type})`);
        }
      }

      await sleep(1000);
    } catch (err) {
      console.error(`Page ${page} failed:`, err);
    }
  }
}

async function main() {
  console.log('⚡ Starting Trending & New Releases Auto-Ingestion...');
  await ingestBatch(['TRENDING_DESC', 'POPULARITY_DESC'], 'Trending Now', 2);
  await ingestBatch(['UPDATED_AT_DESC'], 'Recently Updated Chapters', 2);
  await ingestBatch(['START_DATE_DESC', 'POPULARITY_DESC'], 'Newly Released Titles', 2);
  console.log('\n🎉 Auto-Ingestion Completed Successfully!');
}

main();
