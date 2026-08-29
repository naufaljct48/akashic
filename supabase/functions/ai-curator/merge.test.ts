import { mergeCandidates, VECTOR_SHARE, type VectorRow } from './merge.ts';

/**
 * The dedup here fails silently -- a duplicate just quietly consumes one of the
 * model's candidate slots -- so it gets pinned rather than eyeballed.
 */

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const row = (id: string, sourceId: number): VectorRow => ({
  id,
  source_id: sourceId,
  title_english: `T${sourceId}`,
  title_romaji: null,
  type: 'MANGA',
  status: 'FINISHED',
  release_year: 2011,
  total_chapters: 10,
  average_score: 80,
  genres: ['Action'],
  tags: ['Shounen'],
  synopsis: 's',
});

console.log('mergeCandidates');

// A catalog row the client already sent by UUID.
{
  const out = mergeCandidates([{ id: 'uuid-a' }], [row('uuid-a', 111), row('uuid-b', 222)]);
  assert(out.length === 2, 'a UUID already in the client list is not re-added');
  assert((out[0] as any).id === 'uuid-b', 'the genuinely new row is kept');
}

// The same series, but the client found it via the live AniList feed.
{
  const out = mergeCandidates([{ id: 'anilist-222' }], [row('uuid-b', 222)]);
  assert(out.length === 1, 'a row already present as anilist-<source_id> is not duplicated');
}

// Ordering and shape.
{
  const out = mergeCandidates([{ id: 'anilist-999' }], [row('uuid-b', 222)]);
  assert((out[0] as any).id === 'uuid-b', 'vector rows are placed ahead of client rows');
  assert((out[1] as any).id === 'anilist-999', 'client rows survive the merge');
  assert((out[0] as any).genres === 'Action', 'array fields are flattened for the prompt');
  assert((out[0] as any).title === 'T222', 'english title is preferred');
}

// The cap that protects the client's out-of-catalog reach.
{
  const many = Array.from({ length: 40 }, (_, i) => row(`u${i}`, i));
  const out = mergeCandidates([{ id: 'anilist-999' }], many);
  assert(out.length === VECTOR_SHARE + 1, 'vector rows are capped at VECTOR_SHARE');
  assert((out[out.length - 1] as any).id === 'anilist-999', 'the client row is never crowded out');
}

// Degenerate inputs: the Edge Function passes the raw body through here.
{
  assert(mergeCandidates(undefined, [row('u1', 1)]).length === 1, 'a missing client list is treated as empty');
  assert(mergeCandidates([{ id: 'x' }], []).length === 1, 'no vector rows leaves the client list intact');
  assert(mergeCandidates([{}], [row('u1', 1)]).length === 2, 'a client row with no id does not throw');
}

console.log('\n✅ merge checks passed');
