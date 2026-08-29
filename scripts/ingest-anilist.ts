import { supabase } from './supabase-admin';


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ANILIST_QUERY = `
query GetPopularComics($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
    }
    media(type: MANGA, sort: [POPULARITY_DESC, SCORE_DESC]) {
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

export async function ingestAniList(maxPages = 2) {
  console.log(`🚀 Starting AniList Ingestion (fetching up to ${maxPages} pages)...`);

  for (let page = 1; page <= maxPages; page++) {
    console.log(`\n📄 Fetching AniList Page ${page}...`);

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: ANILIST_QUERY,
          variables: { page, perPage: 25 },
        }),
      });

      if (!res.ok) {
        console.error(`AniList API returned ${res.status}: ${res.statusText}`);
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
            ?.filter((t: any) => t.rank >= 50)
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
        const { data: inserted, error: comicErr } = await supabase
          .from('comics')
          .upsert(comicRecord, { onConflict: 'source_id' })
          .select('id')
          .single();

        if (comicErr || !inserted) {
          console.error(`❌ Failed to upsert ${titleEnglish || titleRomaji}:`, comicErr?.message);
          continue;
        }


        console.log(`✅ Ingested: [${type}] ${titleEnglish || titleRomaji}`);
      }

      console.log(`⏳ Cooldown 1.5s for AniList rate limits...`);
      await sleep(1500);
    } catch (err) {
      console.error(`Page ${page} failed:`, err);
    }
  }

  console.log(`\n🎉 AniList Ingestion completed!`);
}

ingestAniList(2).catch(console.error);
