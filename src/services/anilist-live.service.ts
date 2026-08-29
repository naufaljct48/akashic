import { namesResemble } from '@/core/constants/name-extraction';
import type { Comic, ComicSearchResult } from '@/core/types/comic';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

/** Every field mapMediaListToComics() needs. Kept in one place so the search, */
/** feed, character and trend queries can never drift apart. */
const MEDIA_FIELDS = `
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
`;

async function anilistQuery<T = any>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors) {
      console.warn('[AniList] GraphQL errors:', json.errors);
    }
    return (json.data as T) ?? null;
  } catch (err) {
    console.warn('[AniList] Request failed:', err);
    return null;
  }
}

const SINGLE_COMIC_QUERY = `
query GetSingleComic($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    idMal
    status
    chapters
    volumes
    averageScore
    popularity
    updatedAt
    coverImage {
      extraLarge
      large
    }
  }
}
`;

const SEARCH_COMICS_QUERY = `
query SearchComics($search: String, $type: MediaType, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: $type, sort: [POPULARITY_DESC]) {
      ${MEDIA_FIELDS}
    }
  }
}
`;

export interface LiveUpdateResult {
  updated: boolean;
  chapters: number | null;
  status: string;
  averageScore: number | null;
  coverImageUrl?: string | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch live fresh chapter count, score, and status from AniList GraphQL for a given comic.
 * Returns the fresh values for display; the ingestion cron persists them.
 */
/**
 * One live sync per title per session.
 *
 * AniList allows 30 requests a minute. Opening the spread fires this on every
 * mount, React's StrictMode fires each effect twice in development, and the
 * cover healer and the graph fetch are drawing on the same budget — so browsing
 * a handful of titles in quick succession was enough to earn a 502, whose
 * response carries no CORS headers and therefore surfaces in the console as a
 * CORS failure rather than as the rate limit it is.
 *
 * The promise is cached, not just the result, so a double mount shares one
 * in-flight request instead of racing two. Chapter counts do not change often
 * enough for a per-session cache to go stale in any way a reader would notice.
 */
const liveSyncCache = new Map<number, Promise<LiveUpdateResult>>();

export async function syncLiveComicData(comic: Comic): Promise<LiveUpdateResult> {
  const cached = comic.source_id ? liveSyncCache.get(comic.source_id) : undefined;
  if (cached) return cached;

  const pending = syncLiveComicDataUncached(comic);
  if (comic.source_id) liveSyncCache.set(comic.source_id, pending);
  return pending;
}

async function syncLiveComicDataUncached(comic: Comic): Promise<LiveUpdateResult> {
  const unchanged: LiveUpdateResult = {
    updated: false,
    chapters: comic.total_chapters,
    status: comic.status,
    averageScore: comic.average_score,
    coverImageUrl: comic.cover_image_url,
  };

  const data = await anilistQuery<{ Media: any }>(SINGLE_COMIC_QUERY, { id: comic.source_id });
  const media = data?.Media;
  if (!media) return unchanged;

  const freshCover = media.coverImage?.extraLarge || media.coverImage?.large;
  const hasNewCover = Boolean(freshCover && freshCover !== comic.cover_image_url);
  const hasNewChapters = media.chapters !== null && media.chapters !== comic.total_chapters;
  const hasNewStatus = media.status && media.status !== comic.status;
  const hasNewScore = media.averageScore !== null && media.averageScore !== comic.average_score;

  if (hasNewChapters || hasNewStatus || hasNewScore || hasNewCover) {
    // Fresh values are returned for display only; persisting them is the
    // ingestion cron's job (the browser holds a read-only anon key).
    return {
      updated: true,
      chapters: media.chapters ?? comic.total_chapters,
      status: media.status || comic.status,
      averageScore: media.averageScore ?? comic.average_score,
      coverImageUrl: freshCover || comic.cover_image_url,
    };
  }

  return unchanged;
}

/**
 * Cover lookups are triggered per broken <img>, so a grid of 70+ cards can fire
 * a burst big enough to trip AniList's rate limit — and every extra card added
 * by infinite scroll makes it worse. Cache the promise (not just the result) so
 * duplicate titles rendered in two feeds share a single in-flight request, and
 * so a title that failed once is never re-queried.
 */
const coverLookupCache = new Map<string, Promise<string | null>>();

/**
 * Fetch a fresh working cover image URL from AniList by comic search title or romaji
 */
export function fetchFreshCoverFromAniList(title: string): Promise<string | null> {
  const key = title.trim().toLowerCase();
  if (!key) return Promise.resolve(null);

  const cached = coverLookupCache.get(key);
  if (cached) return cached;

  const lookup = anilistQuery<{ Page: any }>(
    `query SearchFreshCover($search: String) {
      Page(page: 1, perPage: 1) {
        media(search: $search, type: MANGA) {
          id
          coverImage { extraLarge large }
        }
      }
    }`,
    { search: title }
  ).then((data) => {
    const cover = data?.Page?.media?.[0]?.coverImage;
    return cover?.extraLarge || cover?.large || null;
  });

  coverLookupCache.set(key, lookup);
  return lookup;
}

const LIVE_FEED_QUERY = `
query GetLiveFeed($sort: [MediaSort], $status: MediaStatus, $statusIn: [MediaStatus], $country: CountryCode, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: MANGA, sort: $sort, status: $status, status_in: $statusIn, countryOfOrigin: $country) {
      ${MEDIA_FIELDS}
    }
  }
}
`;

function mapMediaListToComics(mediaList: any[]): ComicSearchResult[] {
  const resultList: ComicSearchResult[] = [];

  for (const item of mediaList) {
    if (!item?.id) continue;

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

    // Live AniList hits are shown straight from memory. Writing them to the
    // catalog is the ingestion cron's job — the browser is read-only.
    resultList.push({
      id: `anilist-${item.id}`,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ComicSearchResult);
  }

  return resultList;
}

/**
 * Search AniList on-the-fly if a title doesn't exist in Supabase yet.
 */
export async function searchLiveAniList(query: string, maxResults = 5): Promise<ComicSearchResult[]> {
  const data = await anilistQuery<{ Page: any }>(SEARCH_COMICS_QUERY, {
    search: query,
    type: 'MANGA',
    perPage: maxResults,
  });
  return mapMediaListToComics(data?.Page?.media || []);
}

/**
 * Find comics by what a story *is about*, not by what it is called.
 *
 * The catalog's tag probes only ever reached the ~6,600 ingested rows, so a
 * description of a title we had not ingested could not be answered at all —
 * the model can only rank what retrieval hands it, and it is never allowed to
 * invent a title.
 *
 * Two facts about AniList's data shape this:
 *
 *  1. `tag_in` is AND, not OR. Asking for ['Post-Apocalyptic', 'Music'] returns
 *     nothing, because no single entry carries both. So each tag gets its own
 *     aliased query in one round trip, and the merge ranks by how many of the
 *     hinted tags an entry actually carries.
 *  2. MANGA entries are barely tagged; their ANIME counterparts are tagged
 *     richly. Guilty Crown's manga entry carries one meaningful tag; its anime
 *     entry carries Dystopian, Post-Apocalyptic, Pandemic and sixteen more.
 *     Readers describe the anime they remember, so the search runs against
 *     ANIME entries and then follows each one's ADAPTATION/SOURCE edge back to
 *     the manga this product actually recommends.
 */
export async function searchAniListByConcept(
  tags: string[],
  maxResults = 12
): Promise<ComicSearchResult[]> {
  // Four, not three: the hint dictionary emits its most generic tags first
  // ("Survival", "Post-Apocalyptic"), and cutting at three routinely dropped
  // the one distinctive tag that separates the answer from every blockbuster
  // carrying the same broad theme.
  const probes = tags.slice(0, 4);
  if (probes.length === 0) return [];

  // Step 1 — one aliased query per tag, asking only what ranking needs.
  const aliases = probes
    .map(
      (_, i) => `p${i}: Page(perPage: 25) {
    media(type: ANIME, tag_in: $t${i}, sort: [POPULARITY_DESC]) {
      tags { name }
      relations { edges { relationType node { id type } } }
    }
  }`
    )
    .join('\n  ');
  const varDefs = probes.map((_, i) => `$t${i}: [String]`).join(', ');
  const variables: Record<string, unknown> = {};
  probes.forEach((tag, i) => {
    variables[`t${i}`] = [tag];
  });

  const found = await anilistQuery<Record<string, any>>(
    `query (${varDefs}) {\n  ${aliases}\n}`,
    variables
  );
  if (!found) return [];

  const hinted = new Set(probes);
  // A manga scores by how many hinted tags its anime carried, so an entry that
  // answers two halves of the description outranks one that answers a single
  // popular tag.
  const scoreById = new Map<number, number>();
  for (const page of Object.values(found)) {
    for (const anime of page?.media || []) {
      const hits = (anime.tags || []).reduce(
        (n: number, t: any) => n + (hinted.has(t?.name) ? 1 : 0),
        0
      );
      for (const edge of anime.relations?.edges || []) {
        if (edge?.node?.type !== 'MANGA') continue;
        if (edge.relationType !== 'ADAPTATION' && edge.relationType !== 'SOURCE') continue;
        const id = edge.node.id;
        scoreById.set(id, Math.max(scoreById.get(id) ?? 0, hits));
      }
    }
  }
  if (scoreById.size === 0) return [];

  const ids = [...scoreById.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([id]) => id);

  // Step 2 — full fields for the shortlist only. Asking for them inline in
  // step 1 would have pulled several hundred media objects per search.
  const detail = await anilistQuery<{ Page: any }>(
    `query ($ids: [Int]) {
  Page(perPage: ${maxResults}) {
    media(type: MANGA, id_in: $ids, sort: [POPULARITY_DESC]) {
      ${MEDIA_FIELDS}
    }
  }
}`,
    { ids }
  );

  return mapMediaListToComics(detail?.Page?.media || []);
}

const CHARACTER_MEDIA_FRAGMENT = `
fragment CharacterMedia on Character {
  id
  name { full native alternative }
  media(type: MANGA, sort: [POPULARITY_DESC], perPage: 4) {
    nodes {
      ${MEDIA_FIELDS}
    }
  }
}
`;

/** GraphQL aliases let several spellings share one HTTP round trip (~400ms). */
const MAX_CHARACTER_TERMS = 5;

/**
 * What fraction of the words in the user's name guess this character answers to.
 *
 * "sung jinwoo" scores 1.0 against Solo Leveling's Jin-U Seong (both words) and
 * 0.5 against Dungeon Odyssey's Jin-U Kim (only "jin"), which is the difference
 * between the right answer and a near-miss that happens to share a syllable.
 */
function nameMatchQuality(term: string, names: string[]): number {
  const words = term.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return 0;

  let best = 0;
  for (const name of names) {
    if (!name) continue;
    const matched = words.filter((w) => namesResemble(w, name)).length;
    best = Math.max(best, matched / words.length);
  }
  return best;
}

/**
 * Find comics by the name of a character in them.
 *
 * The catalog stores no character data, so "manhwa yg mc nya Lloyd" used to fall
 * through to a synopsis keyword scan and return confident noise. AniList indexes
 * characters, and this maps a person straight back to their titles.
 *
 * Takes several spellings rather than one, because the caller cannot know which
 * token in a sentence is the name, and because users typo names constantly —
 * AniList's character search is exact-prefix, so "llyod" returns nothing while
 * "lloyd" returns Lloyd Frontera. All the spellings are searched in a single
 * aliased query; results keep the order the terms were supplied in.
 */
export async function searchAniListByCharacter(
  names: string | string[],
  maxResults = 6,
  preferType?: Comic['type']
): Promise<ComicSearchResult[]> {
  const terms = (Array.isArray(names) ? names : [names])
    .map((n) => n.trim())
    .filter((n, i, all) => n.length >= 3 && all.indexOf(n) === i)
    .slice(0, MAX_CHARACTER_TERMS);

  if (terms.length === 0) return [];

  // The most specific guess ("light yagami" beats the bare "light" and the typo
  // variants that follow it) is what result quality is scored against.
  const primaryTerm = terms.reduce(
    (best, t) => (t.split(' ').length > best.split(' ').length ? t : best),
    terms[0]
  );

  const declarations = terms.map((_, i) => `$n${i}: String`).join(', ');
  const aliases = terms
    .map(
      (_, i) =>
        `c${i}: Page(page: 1, perPage: 2) { characters(search: $n${i}, sort: [SEARCH_MATCH]) { ...CharacterMedia } }`
    )
    .join('\n  ');
  const variables = Object.fromEntries(terms.map((t, i) => [`n${i}`, t]));

  const data = await anilistQuery<Record<string, any>>(
    `${CHARACTER_MEDIA_FRAGMENT}\nquery MultiCharacterSearch(${declarations}) {\n  ${aliases}\n}`,
    variables
  );
  if (!data) return [];

  const seen = new Set<string>();
  const out: Array<{ comic: ComicSearchResult; quality: number }> = [];

  for (let i = 0; i < terms.length; i++) {
    for (const character of data[`c${i}`]?.characters || []) {
      const charName = character?.name?.full;
      if (!charName) continue;

      // AniList happily fuzzy-matches an ordinary word onto a real character,
      // so confirm the hit actually answers to what we searched for.
      //
      // Aliases matter as much as the canonical name: Sword Art Online's Kirito
      // is stored as "Kazuto Kirigaya" with "Kirito" only in `alternative`, so
      // checking `full` alone dropped the right answer and left PSYCHO-PASS 2's
      // Kirito Kamui as the only survivor.
      // Canonical and native names get fuzzy matching (romanisation varies);
      // the alias list is matched strictly, since there are many per character.
      const canonical = [charName, character?.name?.native || ''];
      const aliases: string[] = character?.name?.alternative || [];

      const matched =
        canonical.some((name) => name && namesResemble(terms[i], name)) ||
        aliases.some((alias) => alias && namesResemble(terms[i], alias, true));

      if (!matched) continue;

      const quality = nameMatchQuality(primaryTerm, [...canonical, ...aliases]);

      for (const comic of mapMediaListToComics(character.media?.nodes || [])) {
        if (seen.has(comic.id)) continue;
        seen.add(comic.id);
        out.push({
          quality,
          comic: {
            ...comic,
            matchedCharacter: charName,
            matchReason: `Features the character ${charName}.`,
          },
        });
      }
    }
  }

  // "manhwa yg mc nya Lloyd" means the Korean Lloyd Frontera, not Code Geass's
  // Lloyd Asplund. Drop the wrong medium when the user named one — but only if
  // something survives, since the medium is inferred from the query text and a
  // wrong inference must not swallow the only real answer.
  let ranked = out;
  if (preferType) {
    const preferred = out.filter((r) => r.comic.type === preferType);
    if (preferred.length > 0) ranked = preferred;
  }

  // Quality first, popularity only as the tiebreak. Popularity alone is too
  // blunt — it floated My Hero Academia above Dragon Ball for "goku" on the
  // strength of one weak match — while quality alone cannot separate the two
  // titles that both genuinely contain a Kirito. Together they order both.
  ranked = [...ranked].sort(
    (a, b) => b.quality - a.quality || (b.comic.popularity ?? 0) - (a.comic.popularity ?? 0)
  );

  return ranked.slice(0, maxResults).map((r) => r.comic);
}

/**
 * Fetch Live Trending Comics from AniList (Manga, Manhwa, Manhua)
 */
export async function fetchLiveTrendingComics(
  country?: 'KR' | 'JP' | 'CN',
  perPage = 24,
  page = 1
): Promise<ComicSearchResult[]> {
  const data = await anilistQuery<{ Page: any }>(LIVE_FEED_QUERY, {
    sort: ['TRENDING_DESC', 'POPULARITY_DESC'],
    country: country || undefined,
    page,
    perPage,
  });
  return mapMediaListToComics(data?.Page?.media || []);
}

/**
 * Fetch Live Recently Updated Comics (Fresh Chapter Releases)
 */
export async function fetchLiveRecentlyUpdated(
  country?: 'KR' | 'JP' | 'CN',
  perPage = 24,
  page = 1
): Promise<ComicSearchResult[]> {
  const data = await anilistQuery<{ Page: any }>(LIVE_FEED_QUERY, {
    sort: ['UPDATED_AT_DESC'],
    status: 'RELEASING',
    country: country || undefined,
    page,
    perPage,
  });
  return mapMediaListToComics(data?.Page?.media || []);
}

/**
 * Fetch Live New Releases / New Titles
 */
export async function fetchLiveNewReleases(
  country?: 'KR' | 'JP' | 'CN',
  perPage = 24,
  page = 1
): Promise<ComicSearchResult[]> {
  const data = await anilistQuery<{ Page: any }>(LIVE_FEED_QUERY, {
    sort: ['START_DATE_DESC', 'POPULARITY_DESC'],
    statusIn: ['RELEASING', 'NOT_YET_RELEASED'],
    country: country || undefined,
    page,
    perPage,
  });
  return mapMediaListToComics(data?.Page?.media || []);
}

// ============================================================================
// Windowed trending (today / 7 days / 30 days)
// ============================================================================

export type TrendingWindow = 'today' | 'week' | 'month';

export const TRENDING_WINDOW_DAYS: Record<Exclude<TrendingWindow, 'today'>, number> = {
  week: 7,
  month: 30,
};

const TREND_ROWS_QUERY = `
query GetMediaTrends($ids: [Int], $since: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    mediaTrends(mediaId_in: $ids, date_greater: $since, sort: [TRENDING_DESC]) {
      mediaId
      trending
    }
  }
}
`;

/** Ranked windows are stable for the session; paging them must not refetch. */
const trendingWindowCache = new Map<string, ComicSearchResult[]>();

/**
 * Rank comics by their peak daily trend score inside a time window.
 *
 * AniList exposes no date-windowed trending for manga: `Media.sort` only has the
 * instantaneous `TRENDING_DESC`, and `Page.mediaTrends(date_greater:)` returns
 * nothing unless it is also scoped by `mediaId_in`. So this builds a pool of
 * currently-relevant ids, pulls their daily trend rows for the window, and ranks
 * by each title's peak day.
 *
 * ponytail: pool is the top 100 by current trend, and only the highest 250 trend
 * rows are read (5 pages). A title that spiked hard early in a 30-day window but
 * has since fallen out of the top 100 is therefore missed. Widen the pool with
 * extra POPULARITY_DESC pages if that turns out to matter.
 */
async function buildTrendingWindow(
  country: 'KR' | 'JP' | 'CN' | undefined,
  days: number
): Promise<ComicSearchResult[]> {
  const poolPages = await Promise.all([
    fetchLiveTrendingComics(country, 50, 1),
    fetchLiveTrendingComics(country, 50, 2),
  ]);

  const pool = new Map<number, ComicSearchResult>();
  for (const comic of poolPages.flat()) {
    pool.set(comic.source_id, comic);
  }
  if (pool.size === 0) return [];

  const ids = [...pool.keys()];
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const peak = new Map<number, number>();

  for (let page = 1; page <= 5; page++) {
    const data = await anilistQuery<{ Page: any }>(TREND_ROWS_QUERY, { ids, since, page });
    const rows = data?.Page?.mediaTrends || [];
    // Empty page = exhausted, or AniList rate-limited us. Either way, stop
    // rather than burning four more requests against a 429.
    if (rows.length === 0) break;

    for (const row of rows) {
      const current = peak.get(row.mediaId) ?? 0;
      if (row.trending > current) peak.set(row.mediaId, row.trending);
    }

    // Rows arrive sorted by trending desc, so once most of the pool has been
    // seen the remaining pages can only add low peaks that rank last anyway.
    if (peak.size >= ids.length * 0.6) break;
  }

  // No trend history at all (brand-new AniList entries) — keep them, ranked last.
  return [...pool.values()].sort(
    (a, b) => (peak.get(b.source_id) ?? 0) - (peak.get(a.source_id) ?? 0)
  );
}

export async function fetchTrendingWindow(
  window: TrendingWindow,
  country?: 'KR' | 'JP' | 'CN',
  perPage = 24,
  page = 1
): Promise<ComicSearchResult[]> {
  if (window === 'today') {
    return fetchLiveTrendingComics(country, perPage, page);
  }

  const cacheKey = `${country || 'ALL'}:${window}`;
  let ranked = trendingWindowCache.get(cacheKey);
  if (!ranked) {
    ranked = await buildTrendingWindow(country, TRENDING_WINDOW_DAYS[window]);
    trendingWindowCache.set(cacheKey, ranked);
  }

  const from = (page - 1) * perPage;
  return ranked.slice(from, from + perPage);
}
