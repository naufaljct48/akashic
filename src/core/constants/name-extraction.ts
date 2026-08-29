/**
 * Pulling a likely character/title name out of a free-form, code-switched query.
 *
 * "manhwa yg mc nya llyod?" is the motivating case: the previous heuristic
 * required at least two surviving non-stopword tokens, so a query naming exactly
 * one person produced no name at all and the character lookup never ran. It also
 * had no notion of Indonesian particles ("yg", "nya"), so those counted as words.
 */

import { isTropeWord, queryTagHints } from './query-tag-hints';
import { POPULAR_GENRES } from './comic-genres';

/** Tokens that never form part of a name, in either language. */
const NAME_NOISE = new Set([
  'bukan', 'tanpa', 'kalau', 'lebih', 'paling', 'banget', 'agak', 'udah', 'sudah',
  'belum', 'masih', 'bagus', 'jelek', 'seru', 'keren', 'enak', 'lucu',
  // Words about the publication rather than the story. "tamat" is one edit from
  // the real character "Tamate", and "plot" one from "Splot" — string distance
  // cannot separate those, so they have to be named.
  'tamat', 'selesai', 'ongoing', 'ending', 'plot', 'twist', 'twists', 'chapter',
  'chapters', 'bab', 'volume', 'rating', 'score', 'sinopsis', 'synopsis',
  'season', 'series', 'adaptasi', 'adaptation', 'terbaru', 'lama', 'baru',
  'pendek', 'panjang', 'short', 'long', 'complete', 'completed', 'finished',
  // Indonesian particles, pronouns and filler
  'yang', 'yg', 'nya', 'itu', 'ini', 'sih', 'dong', 'deh', 'aja', 'saja', 'kah',
  'gimana', 'gmn', 'siapa', 'apa', 'ada', 'punya', 'pakai', 'pake', 'bisa',
  'kayak', 'kaya', 'mirip', 'seperti', 'tentang', 'dengan', 'tanpa', 'minim',
  'cariin', 'cari', 'kasih', 'pengen', 'pengin', 'buat', 'dari', 'untuk', 'juga',
  'gua', 'gue', 'aku', 'saya', 'kamu', 'lu', 'lo', 'dia', 'dan', 'atau', 'tapi',
  'rekomendasi', 'rekomen', 'saran', 'judul', 'ceritanya', 'cerita', 'alur',
  // English
  'the', 'and', 'for', 'with', 'without', 'about', 'like', 'similar', 'give',
  'find', 'some', 'please', 'best', 'good', 'story', 'series', 'recommend',
  'recommendation', 'recommendations', 'whose', 'where', 'which', 'that', 'have',
  'has', 'was', 'who', 'any', 'are', 'from',
  // Medium words — never the name
  'manga', 'manhwa', 'manhua', 'komik', 'comic', 'comics', 'webtoon', 'webtoons',
  'novel', 'anime',
]);

/**
 * Words that announce "a character name follows": "mc nya Lloyd", "karakter
 * utama Guts", "protagonist Johan". The token after one of these (skipping
 * particles) is the single strongest name signal a query gives us.
 */
const NAME_MARKERS = new Set([
  'mc', 'protagonis', 'protagonist', 'protagonists', 'karakter', 'character',
  'tokoh', 'namanya', 'bernama', 'nama', 'cowok', 'cewek', 'hero', 'heroine',
  'villain', 'utama', 'lead',
]);

/** Genre names are describing the shelf, never the person on it. */
const GENRE_WORDS = new Set(POPULAR_GENRES.map((g) => g.toLowerCase()));

/**
 * A word the trope dictionary already understands is describing a trope, not
 * naming a character.
 *
 * This is not hypothetical: "manhwa murim yang mc nya jenius" put "jenius"
 * straight after a name marker, AniList matched it to Maximilian *Jenius* of
 * Macross, and five Macross volumes landed at the top of a murim search.
 * Reusing the tag dictionary keeps one vocabulary instead of a second
 * hand-maintained blocklist that would drift away from it.
 */
function describesATrope(token: string): boolean {
  if (GENRE_WORDS.has(token)) return true;
  // Single words go through the word-aware check so "level" is caught by the
  // "level up" key; multi-word candidates fall back to full phrase matching.
  return token.includes(' ')
    ? queryTagHints(token).length > 0
    : isTropeWord(token) || queryTagHints(token).length > 0;
}

/**
 * Adjacent-character transpositions — "llyod" -> "lloyd".
 *
 * AniList's character search matches on prefix, not fuzzily, so a single
 * swapped pair returns zero results instead of the obvious answer. Swaps are the
 * most common typo class and there are only n-1 of them, so trying them all is
 * cheaper than any real fuzzy-matching machinery. Bounded to word lengths where
 * the variants stay plausible.
 */
export function transpositions(word: string): string[] {
  if (word.length < 4 || word.length > 12 || word.includes(' ')) return [];

  const out: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] === word[i + 1]) continue; // swapping equal letters is a no-op
    out.push(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
  }
  return out;
}

const normalizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) =>
  a && b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0;

/**
 * 0.6 keeps Korean romanisation variance ("chung" ≈ "Cheong", "myung" ≈
 * "Myeong", both ~0.67) while rejecting coincidence ("tamat" vs "Matama" = 0.5,
 * "building" vs "Oubi" = 0.25).
 */
const NAME_MATCH_THRESHOLD = 0.6;

/**
 * Does an AniList character actually answer to the term we searched for?
 *
 * AniList's SEARCH_MATCH is generous, so an ordinary word that slipped through
 * name extraction still comes back with a confident-looking hit — "building"
 * returned Akitaru *Oubi*, "level" returned Nagito Komaeda. Validating the match
 * catches those structurally, which no blocklist of ordinary words ever could:
 * whatever noise the extractor guesses, a character that does not resemble the
 * guess is dropped.
 */
export function namesResemble(term: string, fullName: string, strict = false): boolean {
  const t = normalizeName(term);
  const n = normalizeName(fullName);
  if (!t || !n) return false;

  // Name order differs across languages ("Kim Dokja" vs "Dok-Ja Kim"), so
  // compare every word against every word rather than positionally.
  const termWords = t.split(' ').filter(Boolean);
  const nameWords = n.split(' ').filter(Boolean);

  for (const tw of termWords) {
    if (tw.length < 3) continue;
    for (const nw of nameWords) {
      if (tw === nw) return true;
      if (tw.length >= 4 && (nw.startsWith(tw) || tw.startsWith(nw))) return true;
      // Four characters is the floor, because Korean syllables romanise that
      // short: rejecting "sung" ≈ "Seong" loses Solo Leveling, the single most
      // searched title in the catalog. Ordinary four-letter words that would
      // slip through here ("plot" scores 0.8 against "Splot") are stopped a
      // layer earlier, by NAME_NOISE — this check is for coincidental
      // characters, not for ordinary vocabulary.
      //
      // `strict` disables it for alias lists: a character carries several
      // aliases, so a 0.6 threshold applied to each multiplies the chance of a
      // coincidence — "eren" scores 0.8 against Rock Lee's "Green Beast".
      //
      // The length guard is what makes the threshold safe: romanising the same
      // syllable shifts length by about one ("sung"/"Seong", "chung"/"Cheong"),
      // so a word half again as long is a different word that merely scores
      // close — "itachi" vs "Hitachiin" is 0.67 and would otherwise drag Ouran
      // High School Host Club into a Naruto query.
      if (
        !strict &&
        tw.length >= 4 &&
        nw.length >= 4 &&
        Math.abs(tw.length - nw.length) <= 2 &&
        similarity(tw, nw) >= NAME_MATCH_THRESHOLD
      ) {
        return true;
      }
    }
  }

  // Romanisations disagree about spacing: "Dokja" vs "Dok-Ja Kim". Only join
  // CONSECUTIVE words — a plain substring test lets "itachi" match inside
  // "HikaruHitachiin" and drags Ouran High School Host Club into a Naruto query.
  const termCompact = t.replace(/\s/g, '');
  if (termCompact.length < 4) return false;

  for (let i = 0; i < nameWords.length; i++) {
    let joined = '';
    for (let j = i; j < nameWords.length; j++) {
      joined += nameWords[j];
      if (joined.length < 4) continue;
      if (joined === termCompact) return true;
      if (joined.startsWith(termCompact) || termCompact.startsWith(joined)) return true;
    }
  }

  return false;
}

/**
 * Ordered guesses at the name a query is asking about, most confident first.
 *
 * Returns several because a sentence gives no reliable way to know which token
 * is the name — and the lookup batches them into one request anyway, so an extra
 * guess costs nothing.
 */
export function extractNameCandidates(raw: string, limit = 3): string[] {
  const out: string[] = [];
  const push = (value: string | undefined) => {
    const cleaned = (value || '').trim();
    if (cleaned.length >= 3 && !out.includes(cleaned)) out.push(cleaned);
  };

  // 1. Capitalised runs — "Lloyd Frontera", "Johan Liebert". Longest first.
  const capitalised = (raw.match(/\b[A-Z][a-z']{2,}(?:\s+[A-Z][a-z']{2,}){0,2}\b/g) || [])
    .filter((c) => !NAME_NOISE.has(c.toLowerCase()) && !describesATrope(c.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  capitalised.forEach(push);

  const tokens = raw
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // Indonesian glues the possessive on: "tokohnya", "karakternya", "MC-nya".
  // Without this the whole glued word looks like an unknown proper noun and
  // burns a lookup slot, and the marker it contains goes unrecognised.
  const stem = (t: string) => (t.length > 5 && t.endsWith('nya') ? t.slice(0, -3) : t);
  const isMarker = (t?: string) => Boolean(t) && (NAME_MARKERS.has(t!) || NAME_MARKERS.has(stem(t!)));
  const isContent = (t?: string) =>
    Boolean(t) &&
    !NAME_NOISE.has(t!) &&
    !NAME_NOISE.has(stem(t!)) &&
    !isMarker(t) &&
    !describesATrope(t!);

  // 2. Whatever follows a "the protagonist is…" marker, particles skipped.
  for (let i = 0; i < tokens.length; i++) {
    if (!isMarker(tokens[i])) continue;

    let j = i + 1;
    while (j < tokens.length && !isContent(tokens[j])) j++;
    if (j >= tokens.length) continue;

    // Prefer a two-word name when the next token also looks like one.
    if (isContent(tokens[j + 1])) push(`${tokens[j]} ${tokens[j + 1]}`);
    push(tokens[j]);
  }

  // 3. Adjacent content-word pairs — a bare "levi ackerman" carries no marker
  //    and no capitals, so without this only the longest single word survives
  //    and "ackerman" alone resolves to Mikasa.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (isContent(tokens[i]) && isContent(tokens[i + 1])) {
      push(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }

  // 4. Leftover content words, longest first. This is the branch that rescues
  //    "manhwa yg mc nya llyod?" down to the single token "llyod".
  tokens
    .filter((t) => t.length >= 4 && isContent(t))
    .sort((a, b) => b.length - a.length)
    .forEach(push);

  return out.slice(0, limit);
}

/**
 * Name guesses plus typo variants, ordered for a single batched lookup:
 * every literal guess first, then repairs of the most likely one.
 */
export function characterSearchTerms(raw: string, limit = 5): string[] {
  const names = extractNameCandidates(raw);
  const terms = [...names];

  for (const name of names) {
    for (const variant of transpositions(name)) {
      if (terms.length >= limit) break;
      if (!terms.includes(variant)) terms.push(variant);
    }
  }

  return terms.slice(0, limit);
}
