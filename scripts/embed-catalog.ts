import { supabase } from './supabase-admin';
import {
  embedAdaptive,
  chunkByBudget,
  EMBED_MODEL,
  MAX_BATCH_CHARS,
  MAX_TEXT_CHARS,
} from './workers-ai';

/**
 * Backfills comic_embeddings for every catalog row that lacks one.
 *
 * Resumable by construction: it reads the comic_ids already embedded and skips
 * them, so a crash, a rate limit, or a closed laptop costs only the batch in
 * flight. There is no checkpoint file to go stale -- the database is the
 * checkpoint. That matters here; the ingest pipeline lost pages precisely
 * because its checkpoint only recorded forward progress.
 */

const FETCH_PAGE = 1000;

/** Synopses arrive with stray markup even at asHtml:false. */
function clean(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ComicRow {
  id: string;
  title_romaji: string | null;
  title_english: string | null;
  type: string | null;
  genres: string[] | null;
  tags: string[] | null;
  synopsis: string | null;
}

/**
 * The shape the column comment specifies: Title + Type + Genres + Tags +
 * Synopsis. Both titles go in because readers search under either, and the
 * romaji and English names of a series are often unrecognisably different.
 */
function buildContentText(c: ComicRow): string {
  const titles = [c.title_romaji, c.title_english].filter(Boolean).join(' / ');
  const parts = [
    titles,
    c.type ?? '',
    (c.genres ?? []).join(', '),
    (c.tags ?? []).join(', '),
    clean(c.synopsis),
  ];
  // Bounded so one runaway synopsis cannot exceed the batch ceiling on its
  // own. The premise -- what a description-shaped query actually matches on
  // -- lives in the opening lines; the tail is plot detail.
  // ponytail: flat truncation, move to sentence-boundary trimming if recall
  // on long-synopsis titles measures poorly in stage 6.
  return parts.filter((p) => p.length > 0).join('. ').slice(0, MAX_TEXT_CHARS);
}

async function fetchAlreadyEmbedded(): Promise<Set<string>> {
  const done = new Set<string>();
  let from = 0;

  for (;;) {
    const { data, error } = await (supabase.from('comic_embeddings') as any)
      .select('comic_id')
      .range(from, from + FETCH_PAGE - 1);

    if (error) throw new Error(`Reading existing embeddings failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) done.add(row.comic_id);
    if (data.length < FETCH_PAGE) break;
    from += FETCH_PAGE;
  }

  return done;
}

async function fetchComics(): Promise<ComicRow[]> {
  const all: ComicRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await (supabase.from('comics') as any)
      .select('id, title_romaji, title_english, type, genres, tags, synopsis')
      .order('popularity', { ascending: false })
      .range(from, from + FETCH_PAGE - 1);

    if (error) throw new Error(`Reading catalog failed: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < FETCH_PAGE) break;
    from += FETCH_PAGE;
  }

  return all;
}

async function main() {
  console.log(`🧭 Embedding catalog with ${EMBED_MODEL} (<=${MAX_BATCH_CHARS} chars/batch)`);

  const [embedded, comics] = await Promise.all([fetchAlreadyEmbedded(), fetchComics()]);
  const pending = comics.filter((c) => !embedded.has(c.id));

  console.log(`   Catalog: ${comics.length} rows`);
  console.log(`   Already embedded: ${embedded.size}`);
  console.log(`   To embed: ${pending.length}\n`);

  if (pending.length === 0) {
    console.log('✅ Nothing to do — every row already has a vector.');
    return;
  }

  let written = 0;
  const failedBatches: { rows: number; reason: string }[] = [];

  // Batch by character budget, not by row count. The model's 60,000-token
  // ceiling applies to the whole request, so a fixed 100 rows is comfortable
  // for short entries and 50% over the limit for long ones -- which is exactly
  // how the first run failed.
  const prepared = pending.map((c) => ({ comic: c, text: buildContentText(c) }));
  const batches = chunkByBudget(prepared, (p) => p.text.length);

  console.log(`   Batches: ${batches.length}\n`);

  for (const [idx, batch] of batches.entries()) {
    const chars = batch.reduce((n, p) => n + p.text.length, 0);
    process.stdout.write(
      `  📦 Batch ${idx + 1}/${batches.length} (${batch.length} rows, ${chars} chars)... `
    );

    try {
      const vectors = await embedAdaptive(batch.map((p) => p.text));

      const rows = batch.map((p, i) => ({
        comic_id: p.comic.id,
        content_text: p.text,
        embedding: vectors[i],
      }));

      for (let r = 0; r < rows.length; r += 25) {
        const subChunk = rows.slice(r, r + 25);
        const { error } = await (supabase.from('comic_embeddings') as any).upsert(subChunk, {
          onConflict: 'comic_id',
        });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
      }

      written += rows.length;
      console.log(`✅ ${written}/${pending.length}`);
    } catch (err) {
      console.log('❌');
      console.error(`     ${err}`);
      failedBatches.push({ rows: batch.length, reason: String(err) });
    }
  }

  console.log(`\n📊 Embedded ${written}/${pending.length} rows.`);

  // A failed batch is not a skipped batch. Exiting non-zero keeps CI honest and
  // leaves the rows unembedded rather than pretending they are done -- a rerun
  // picks them up automatically, since the database is the checkpoint.
  if (failedBatches.length > 0) {
    console.error(`❌ ${failedBatches.length} batch(es) failed after all retries:`);
    for (const f of failedBatches) {
      console.error(`   - ${f.rows} rows: ${f.reason}`);
    }
    console.error('   Rerun this script; it resumes from what is already stored.');
    process.exit(1);
  }

  console.log('🎉 Backfill complete.');
}

main().catch((err) => {
  console.error(`❌ ${err}`);
  process.exit(1);
});
