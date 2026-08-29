/**
 * Catalog filter smoke check, run against the live Supabase catalog.
 *
 * Exists because the trope pills silently rotted: the labels were hand-invented
 * ("Murim", "System / Level Up", "Overpowered MC") while the catalog stores raw
 * AniList tag names, so eight of them matched zero rows and the filter looked
 * broken rather than empty. A unit test cannot catch that — the query is valid,
 * the data just isn't there. This asserts against the real vocabulary.
 *
 *   bun run test:filters
 */
import { POPULAR_TROPES } from '../src/core/constants/comic-genres';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.');
}

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

async function rows(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/comics?${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function count(path: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/comics?${path}&limit=1`, {
    headers: { ...headers, Prefer: 'count=exact' },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Number((res.headers.get('content-range') || '').split('/')[1] || 0);
}

const arrayLiteral = (values: string[]) => `{${values.map((v) => `"${v}"`).join(',')}}`;

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed++;
}

// 1. Every trope pill must be backed by tags that actually exist in the catalog.
//    A pill returning nothing is worse than no pill: it reads as a broken filter.
const MIN_ROWS_PER_TROPE = 10;
const underpopulated: string[] = [];
for (const trope of POPULAR_TROPES) {
  if (!trope.tags) continue;
  const n = await count(`select=id&tags=ov.${arrayLiteral(trope.tags)}`);
  if (n < MIN_ROWS_PER_TROPE) underpopulated.push(`${trope.label} (${n})`);
}
check(
  `every trope pill matches >= ${MIN_ROWS_PER_TROPE} titles`,
  underpopulated.length === 0,
  underpopulated.join('; ')
);

// 2. excludeGenres must actually exclude, not merely shrink the result set.
const EXCLUDED = ['Romance', 'Ecchi', 'Hentai'];
const excluded = await rows(
  `select=genres&tags=ov.${arrayLiteral(['Cultivation'])}&genres=not.ov.${arrayLiteral(EXCLUDED)}&limit=200`
);
const leaks = excluded.filter((r) => (r.genres || []).some((g: string) => EXCLUDED.includes(g)));
check('"No Romance" leaks no excluded genre', leaks.length === 0, `${leaks.length}/${excluded.length} leaked`);

// 3. Paged ranges must not overlap. Ordering by a non-unique column alone lets
//    Postgres reshuffle ties between requests, which duplicates and drops cards
//    mid-infinite-scroll; the `id` tiebreaker in getComics is what prevents it.
const order = 'order=popularity.desc.nullslast,id.asc';
const [page1, page2] = await Promise.all([
  rows(`select=id&${order}&offset=0&limit=24`),
  rows(`select=id&${order}&offset=24&limit=24`),
]);
const firstIds = new Set(page1.map((r) => r.id));
const overlap = page2.filter((r) => firstIds.has(r.id));
check(
  'consecutive pages do not overlap',
  page1.length === 24 && page2.length === 24 && overlap.length === 0,
  `p1=${page1.length} p2=${page2.length} overlap=${overlap.length}`
);

console.log(failed === 0 ? '\nAll catalog filter checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
