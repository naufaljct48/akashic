import { supabase } from './supabase-admin';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

const BATCH_QUERY = `
query GetBulkMedia($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: MANGA) {
      id
      title {
        english
        romaji
      }
      coverImage {
        extraLarge
        large
      }
      bannerImage
    }
  }
}
`;

async function fetchFromJikanFallback(title: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1`);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.data?.[0];
    return item?.images?.webp?.large_image_url || item?.images?.jpg?.large_image_url || null;
  } catch {
    return null;
  }
}

async function fixAllCovers() {
  console.log('🚀 Starting Bulk Cover Healing Pipeline (AniList GraphQL + Jikan Fallback)...');

  const { data: comics, error } = await supabase
    .from('comics')
    .select('id, source_id, title_english, title_romaji, cover_image_url');

  if (error || !comics) {
    console.error('Failed to fetch comics from Supabase:', error);
    return;
  }

  console.log(`Found ${comics.length} comics to verify & heal.`);

  const chunkSize = 40;
  let updatedCount = 0;

  for (let i = 0; i < comics.length; i += chunkSize) {
    const chunk = comics.slice(i, i + chunkSize);
    const sourceIds = chunk.map((c) => c.source_id).filter(Boolean);

    try {
      const res = await fetch(ANILIST_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: BATCH_QUERY,
          variables: { ids: sourceIds },
        }),
      });

      if (!res.ok) {
        console.warn(`[Batch ${i / chunkSize + 1}] AniList request failed (${res.status}), waiting 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const json = await res.json();
      const mediaList: any[] = json.data?.Page?.media || [];
      const mediaMap = new Map<number, any>();
      for (const m of mediaList) {
        mediaMap.set(m.id, m);
      }

      for (const c of chunk) {
        const liveMedia = mediaMap.get(c.source_id);
        const liveCover = liveMedia?.coverImage?.extraLarge || liveMedia?.coverImage?.large;

        if (liveCover && liveCover !== c.cover_image_url) {
          const { error: updateErr } = await supabase
            .from('comics')
            .update({
              cover_image_url: liveCover,
              updated_at: new Date().toISOString(),
            })
            .eq('id', c.id);

          if (!updateErr) {
            updatedCount++;
            console.log(`[Healed AniList] ${c.title_english || c.title_romaji} -> ${liveCover}`);
          }
        }
      }

      console.log(`[Batch Progress] Processed ${Math.min(i + chunkSize, comics.length)} / ${comics.length} comics...`);
      // Polite rate limit delay for AniList
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`Error in batch ${i}:`, err);
    }
  }

  console.log(`\n✨ Done! Successfully updated and healed ${updatedCount} comic covers across the database.`);
}

fixAllCovers();
