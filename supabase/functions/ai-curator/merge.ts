/**
 * Candidate merging, split out from index.ts so it can be tested.
 *
 * Everything here is pure and free of Deno globals, which is what lets `bun`
 * run merge.test.ts against the exact code the Edge Function ships.
 */

/**
 * How many pool slots vector search may claim. The rest stay with the client's
 * candidates, which is not politeness: the client's list is the only one that
 * can contain a title the catalog never ingested, since it draws on live
 * AniList. Vector search only ever sees what was embedded.
 */
export const VECTOR_SHARE = 14;

export interface VectorRow {
  id: string;
  source_id: number | null;
  title_english: string | null;
  title_romaji: string | null;
  type: string | null;
  status: string | null;
  release_year: number | null;
  total_chapters: number | null;
  average_score: number | null;
  genres: string[] | null;
  tags: string[] | null;
  synopsis: string | null;
}

/**
 * Vector hits reshaped like client candidates and deduped against them.
 *
 * Identity has to be checked twice. The same series arrives as a catalog UUID
 * when the database found it and as `anilist-<source_id>` when the live feed
 * did, so a single-key check lets a duplicate through -- and a duplicate is not
 * merely untidy, it spends one of the model's limited slots on a title the
 * pool already holds.
 *
 * Vector rows go first because they are the better-ranked list, but only up to
 * VECTOR_SHARE, so the client's out-of-catalog reach survives the cap.
 */
export function mergeCandidates(clientRaw: unknown, rows: VectorRow[]) {
  const client = Array.isArray(clientRaw) ? clientRaw : [];
  const seen = new Set(client.map((c: any) => String(c?.id ?? '')));

  const fromVector: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (fromVector.length >= VECTOR_SHARE) break;
    if (!r?.id) continue;
    if (seen.has(r.id) || seen.has(`anilist-${r.source_id}`)) continue;

    seen.add(r.id);
    fromVector.push({
      id: r.id,
      title: r.title_english || r.title_romaji,
      type: r.type,
      status: r.status,
      year: r.release_year,
      chapters: r.total_chapters,
      score: r.average_score,
      genres: (r.genres || []).join(', '),
      tags: (r.tags || []).join(', '),
      synopsis: r.synopsis || '',
    });
  }

  return [...fromVector, ...client];
}
