import { supabase } from '@/lib/supabase/client';
import { csArray, ilikePattern, pgArrayLiteral } from '@/lib/supabase/filters';
import { analyzeAndRankWithDeepSeek } from './deepseek.service';
import { searchLiveAniList, searchAniListByCharacter } from './anilist-live.service';
import { queryTagHints } from '@/core/constants/query-tag-hints';
import { characterSearchTerms } from '@/core/constants/name-extraction';
import type { Comic, ComicFilterParams, ComicSearchResult, ComicType } from '@/core/types/comic';

/** Rows per page everywhere in the app. One number so every grid scrolls alike. */
export const PAGE_SIZE = 24;

export async function getComics(params: ComicFilterParams = {}): Promise<Comic[]> {
  let query = (supabase.from('comics') as any).select('*');

  if (params.type && params.type !== 'ALL') {
    query = query.eq('type', params.type);
  }

  if (params.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }

  if (params.genres && params.genres.length > 0) {
    query = query.overlaps('genres', params.genres);
  }

  // Tags arrive already resolved to real AniList tag names (see resolveTropeFilters).
  if (params.tags && params.tags.length > 0) {
    query = query.overlaps('tags', params.tags);
  }

  // Backs the "No Romance" pill: drop anything carrying an excluded genre.
  if (params.excludeGenres && params.excludeGenres.length > 0) {
    query = query.not('genres', 'ov', pgArrayLiteral(params.excludeGenres));
  }

  if (params.minScore) {
    query = query.gte('average_score', params.minScore);
  }

  if (params.query && params.query.trim()) {
    const q = ilikePattern(params.query.trim());
    query = query.or(
      `title_english.ilike.${q},title_romaji.ilike.${q},synopsis.ilike.${q}`
    );
  }

  // Sorting. Every sort gets `id` as a tiebreaker — without a unique final key,
  // Postgres is free to order rows with equal popularity differently per request,
  // which makes range-paged infinite scroll drop and duplicate titles.
  switch (params.sortBy) {
    case 'score':
      query = query.order('average_score', { ascending: false, nullsFirst: false });
      break;
    case 'year':
      query = query.order('release_year', { ascending: false, nullsFirst: false });
      break;
    case 'popularity':
    default:
      query = query.order('popularity', { ascending: false, nullsFirst: false });
      break;
  }
  query = query.order('id', { ascending: true });

  const limit = params.limit || PAGE_SIZE;
  const page = params.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error } = await query;
  if (error) {
    console.error('[comicService.getComics] Error:', error);
    return [];
  }

  return (data as Comic[]) || [];
}

export async function getComicBySlug(slug: string): Promise<Comic | null> {
  const { data, error } = await (supabase.from('comics') as any)
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    console.error('[comicService.getComicBySlug] Error:', error);
    return null;
  }

  return data as Comic;
}

export interface SemanticSearchResult {
  summary?: string;
  results: ComicSearchResult[];
}

/**
 * Resolve a bare title to something the inspector can display.
 *
 * Community recommendations and franchise relations come from AniList and carry
 * only a title string, and plenty of them are not in the local catalog — so a
 * catalog-only lookup silently returns nothing and the click appears dead.
 * Falls through to AniList so every recommendation is always openable.
 */
export async function findComicByTitle(title: string): Promise<ComicSearchResult | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const matches = await getComics({ query: trimmed, limit: 5 });
  if (matches.length > 0) {
    // Prefer an exact title hit over the most popular substring match.
    const exact = matches.find(
      (c) =>
        c.title_english?.toLowerCase() === trimmed.toLowerCase() ||
        c.title_romaji?.toLowerCase() === trimmed.toLowerCase()
    );
    return (exact ?? matches[0]) as ComicSearchResult;
  }

  const live = await searchLiveAniList(trimmed, 1);
  return live[0] ?? null;
}

/**
 * Checks if user is asking an AI recommendation query vs typing a direct title.
 */
function isSemanticIntent(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Intent trigger keywords
  const intentTriggers = [
    'kayak', 'mirip', 'seperti', 'rekomendasi', 'recommend', 'similar', 'like',
    'yang', 'tanpa', 'dengan', 'minim', 'tentang', 'about', 'without',
    'mc', 'protagonist', 'karakter', 'alur', 'plot', 'cerita', 'story',
    'licik', 'cunning', 'jenius', 'genius', 'smart', 'op', 'overpower', 'overpowered',
    'murim', 'isekai', 'reinkarnasi', 'reincarnation', 'regresi', 'regression',
    'kingdom', 'bangun', 'kerajaan', 'horror', 'psychological', 'dark', 'thriller'
  ];

  for (const trigger of intentTriggers) {
    if (lower.includes(trigger)) return true;
  }

  return words.length >= 4;
}

/**
 * Fast Direct Title Search (0ms LLM latency, 100% accurate)
 */
async function searchDirectTitle(
  query: string,
  filterType?: 'MANGA' | 'MANHWA' | 'MANHUA',
  locale: 'id' | 'en' = 'id'
): Promise<SemanticSearchResult> {
  const clean = query.trim();
  let dbQuery = (supabase.from('comics') as any)
    .select('*')
    .or(
      `title_english.ilike.${ilikePattern(clean)},title_romaji.ilike.${ilikePattern(
        clean
      )},synonyms.cs.${csArray(clean)}`
    )
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(PAGE_SIZE);

  if (filterType) {
    dbQuery = dbQuery.eq('type', filterType);
  }

  let { data: matches } = await dbQuery;

  // Nothing by title — the query may name a *character* rather than a series
  // ("Lloyd Frontera", "Chung Myung"). AniList indexes those; our catalog doesn't.
  // The raw string goes first, then extracted names and typo repairs.
  if (!matches || matches.length === 0) {
    const byCharacter = await searchAniListByCharacter(
      [clean, ...characterSearchTerms(clean)],
      PAGE_SIZE,
      filterType
    );
    if (byCharacter.length > 0) {
      matches = byCharacter as any[];
    }
  }

  // Still nothing in the local catalog — fall back to a live AniList title lookup
  if (!matches || matches.length === 0) {
    const live = await searchLiveAniList(clean, 8);
    matches = live as any[];
  }

  const results: ComicSearchResult[] = (matches || []).map((comic: any) => ({
    ...comic,
    matchReason:
      comic.matchReason ||
      (comic.title_english?.toLowerCase() === clean.toLowerCase() ||
      comic.title_romaji?.toLowerCase() === clean.toLowerCase()
        ? locale === 'id' ? 'Judul cocok persis dengan pencarian Anda.' : 'Exact title match.'
        : locale === 'id' ? `Cocok dengan kata kunci "${clean}".` : `Matches keyword "${clean}".`),
  }));

  return {
    summary:
      results.length > 0
        ? locale === 'id'
          ? `Ditemukan ${results.length} judul yang cocok dengan "${clean}".`
          : `Found ${results.length} titles matching "${clean}".`
        : locale === 'id'
        ? `Tidak ada judul yang cocok dengan "${clean}".`
        : `No titles found matching "${clean}".`,
    results,
  };
}

/** Words that carry no retrieval signal in either language. */
const STOP_WORDS = new Set([
  'yang', 'kayak', 'mirip', 'seperti', 'tentang', 'dengan', 'tanpa', 'minim', 'banget',
  'cariin', 'cari', 'kasih', 'pengen', 'pengin', 'buat', 'dong', 'gua', 'gue', 'aku',
  'manga', 'manhwa', 'manhua', 'komik', 'comic', 'webtoon', 'rekomendasi', 'rekomen',
  'recommend', 'recommendation', 'similar', 'like', 'about', 'without', 'with', 'the',
  'and', 'for', 'give', 'find', 'some', 'please', 'best', 'good', 'story', 'series',
]);

/**
 * Multi-faceted candidate retrieval for AI semantic queries.
 *
 * Four independent probes feed one dedup'd pool, because no single probe covers
 * the ways people actually phrase these questions:
 *   1. character match  — "manhwa yg mc nya Lloyd" (AniList-only knowledge)
 *   2. title match      — "cerita mirip Nano Machine"
 *   3. trope/tag match  — "murim tanpa regresi" -> Cultivation/Wuxia/Martial Arts
 *   4. keyword match    — free-text over synopsis
 *
 * The character probe runs FIRST and its hits stay at the head of the pool. It
 * is the highest-precision signal we have, and the pool is truncated before it
 * reaches the model — a correct hit buried at position 30 is a hit thrown away.
 */
async function retrieveSemanticCandidates(
  userQuery: string,
  filterType?: 'MANGA' | 'MANHWA' | 'MANHUA'
): Promise<Comic[]> {
  const lowerQ = userQuery.toLowerCase().trim();
  const candidateMap = new Map<string, Comic>();

  // Detect explicit format preference in query text
  let inferredType = filterType;
  if (!inferredType) {
    if (lowerQ.includes('manhwa') && !lowerQ.includes('manga') && !lowerQ.includes('manhua')) {
      inferredType = 'MANHWA';
    } else if (lowerQ.includes('manga') && !lowerQ.includes('manhwa') && !lowerQ.includes('manhua')) {
      inferredType = 'MANGA';
    } else if (lowerQ.includes('manhua') && !lowerQ.includes('manga') && !lowerQ.includes('manhwa')) {
      inferredType = 'MANHUA';
    }
  }

  const addAll = (rows: Comic[] | null | undefined) => {
    for (const row of rows || []) candidateMap.set(row.id, row);
  };

  const cleanQuery = lowerQ
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // ---- 1. Character-name probe (highest precision, so it goes first) ------
  const nameTerms = characterSearchTerms(userQuery);
  if (nameTerms.length > 0) {
    addAll((await searchAniListByCharacter(nameTerms, 8, inferredType)) as Comic[]);
  }

  // ---- 2. Direct title matching -------------------------------------------
  let titleProbeHits = 0;
  const titleProbe = cleanQuery.join(' ').trim();
  if (titleProbe.length >= 3) {
    let directQ = (supabase.from('comics') as any)
      .select('*')
      .or(
        `title_english.ilike.${ilikePattern(titleProbe)},title_romaji.ilike.${ilikePattern(
          titleProbe
        )}`
      )
      .order('popularity', { ascending: false, nullsFirst: false })
      .limit(10);

    if (inferredType) directQ = directQ.eq('type', inferredType);
    const { data } = await directQ;
    titleProbeHits = data?.length ?? 0;
    addAll(data);
  }

  // ---- 3. Trope / tag probe -----------------------------------------------
  const hintedTags = queryTagHints(lowerQ);
  if (hintedTags.length > 0) {
    // `overlaps` is an ANY match, so ordering its raw output by score just
    // surfaces the best-rated title that happens to share ONE tag — which is
    // how "manhwa murim mc jenius" came back as One Piece and Berserk. Pull a
    // wider slice and rank it by how many of the hinted tags each title
    // actually carries; relevance first, quality only as the tiebreak.
    let tagQ = (supabase.from('comics') as any)
      .select('*')
      .overlaps('tags', hintedTags)
      .order('popularity', { ascending: false, nullsFirst: false })
      .limit(120);

    if (inferredType) tagQ = tagQ.eq('type', inferredType);

    const { data } = await tagQ;
    const hintSet = new Set(hintedTags);

    const ranked = ((data as Comic[]) || [])
      .map((comic) => ({
        comic,
        hits: comic.tags?.reduce((n, t) => n + (hintSet.has(t) ? 1 : 0), 0) ?? 0,
      }))
      .sort(
        (a, b) => b.hits - a.hits || (b.comic.average_score ?? 0) - (a.comic.average_score ?? 0)
      )
      .slice(0, 20)
      .map((r) => r.comic);

    addAll(ranked);
  }

  // ---- 4. Free-text keyword probe over synopsis ---------------------------
  for (const kw of cleanQuery.slice(0, 5)) {
    let q = (supabase.from('comics') as any)
      .select('*')
      .or(
        `title_english.ilike.${ilikePattern(kw)},title_romaji.ilike.${ilikePattern(
          kw
        )},synopsis.ilike.${ilikePattern(kw)}`
      )
      .order('popularity', { ascending: false, nullsFirst: false })
      .limit(12);

    if (inferredType) q = q.eq('type', inferredType);
    const { data } = await q;
    addAll(data);
  }

  // ---- 5. Live AniList title lookup for a title we do not have ------------
  // The catalog holds ~6.6k titles; AniList holds far more. Gate this on the
  // TITLE probe rather than on the pool size: the trope probes above happily
  // fill the pool with topically-similar titles while the one actually named is
  // missing, so "pool is small" never becomes true and the named title is never
  // fetched. Reuse the extracted name — a query with no name in it is a trope
  // query, and does not deserve the extra round trip.
  //
  // Hinted tags are the second half of that gate. Name extraction is a
  // heuristic over a sentence, so a long trope query always leaves *some*
  // leftover word behind ("underrated", "realistic") — and this probe's hits
  // are ranked to the head of the pool, so one bad guess buries every correct
  // tag match. If the query named real tropes, probes 3/4 already have the
  // candidates and a speculative title lookup can only add noise.
  const liveTitleIds = new Set<string>();
  if (titleProbeHits === 0 && nameTerms.length > 0 && hintedTags.length === 0) {
    const live = (await searchLiveAniList(nameTerms[0], 8)) as Comic[];
    live.forEach((c) => liveTitleIds.add(c.id));
    addAll(live);
  }

  // ---- 6. Popularity padding, so the model always has something to rank ---
  if (candidateMap.size < 12) {
    addAll(
      await getComics({
        type: inferredType,
        limit: 25,
        sortBy: 'popularity',
      })
    );
  }

  // Stable partition, highest-precision signal first. Ordering is not cosmetic:
  // the pool is truncated here, again at 24 for the model, and again at 12 for
  // the deterministic fallback. A live title hit added by probe 5 lands last in
  // insertion order, so without this the title the user actually named gets
  // fetched and then sliced straight back off.
  const pool = Array.from(candidateMap.values());
  const rank = (c: Comic) =>
    (c as ComicSearchResult).matchedCharacter ? 0 : liveTitleIds.has(c.id) ? 1 : 2;

  return pool
    .map((comic, index) => ({ comic, index }))
    .sort((a, b) => rank(a.comic) - rank(b.comic) || a.index - b.index)
    .map((entry) => entry.comic)
    .slice(0, 40);
}

export async function searchComicsSemantic(
  userQuery: string,
  filterType?: 'MANGA' | 'MANHWA' | 'MANHUA',
  locale: 'id' | 'en' = 'id'
): Promise<SemanticSearchResult> {
  const trimmed = userQuery.trim();
  if (!trimmed) {
    const defaultComics = await getComics({ limit: PAGE_SIZE });
    return { results: defaultComics };
  }

  // FAST PATH: If user is typing a direct title (e.g. "Lookism", "One Piece", "Berserk"), do instant DB search!
  if (!isSemanticIntent(trimmed)) {
    return await searchDirectTitle(trimmed, filterType, locale);
  }

  // AI PATH: If user is asking a semantic recommendation query
  try {
    let candidateComics = await retrieveSemanticCandidates(trimmed, filterType);

    if (candidateComics.length < 2 && trimmed.length >= 2) {
      const liveResults = await searchLiveAniList(trimmed, 6);
      if (liveResults.length > 0) {
        candidateComics = [...liveResults, ...candidateComics];
      }
    }

    const deepSeekResult = await analyzeAndRankWithDeepSeek(
      trimmed,
      candidateComics,
      locale
    );

    if (deepSeekResult && deepSeekResult.rankedComics.length > 0) {
      return {
        summary: deepSeekResult.summary,
        results: deepSeekResult.rankedComics,
      };
    }

    // Fallback Heuristic Matcher
    const fallbackResults: ComicSearchResult[] = candidateComics.slice(0, 12).map((item) => ({
      ...item,
      matchReason: generateFallbackReason(item, trimmed, locale),
    }));

    return {
      summary:
        locale === 'id'
          ? `Menemukan ${fallbackResults.length} judul yang paling relevan dengan kueri Anda.`
          : `Found ${fallbackResults.length} titles closely matching your query.`,
      results: fallbackResults,
    };
  } catch (err) {
    console.error('[comicService.searchComicsSemantic] Error:', err);
    return {
      results: [],
    };
  }
}

function generateFallbackReason(comic: any, query: string, locale: 'id' | 'en'): string {
  const lowerQ = query.toLowerCase();
  const hinted = new Set(queryTagHints(lowerQ));
  const matchedTags = comic.tags?.filter((t: string) => hinted.has(t));

  if (matchedTags && matchedTags.length > 0) {
    return locale === 'id'
      ? `Sangat cocok dengan tropes: ${matchedTags.join(', ')}.`
      : `Closely matches requested tropes: ${matchedTags.join(', ')}.`;
  }

  return locale === 'id'
    ? `Direkomendasikan berdasarkan tema ${comic.genres?.join(', ')} dan rating tinggi (${comic.average_score}/100).`
    : `Recommended based on ${comic.genres?.join(', ')} themes and high rating (${comic.average_score}/100).`;
}

export async function getRandomGemComic(type?: ComicType | 'ALL'): Promise<Comic | null> {
  try {
    const randomOffset = Math.floor(Math.random() * 100);
    let query = (supabase.from('comics') as any)
      .select('*')
      .gte('average_score', 78)
      .order('popularity', { ascending: false, nullsFirst: false })
      .range(randomOffset, randomOffset + 15);

    if (type && type !== 'ALL') {
      query = query.eq('type', type);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex] as Comic;
    }
  } catch (err) {
    console.error('Failed to fetch random gem comic:', err);
  }
  return null;
}
