/**
 * bge-m3 embeddings via Cloudflare Workers AI.
 *
 * Reachable as a plain REST call, so nothing here needs a deployed Worker --
 * the same shape the ai-curator Edge Function will use for the query side.
 *
 * The model is symmetric: BAAI's card states bge-m3 "no longer requires adding
 * instructions to the queries", so documents and queries are embedded the same
 * way. Do not add a prefix to one side; that is the classic way to make a
 * retrieval system quietly worse while still looking like it works.
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  const missing = [
    !ACCOUNT_ID && 'CLOUDFLARE_ACCOUNT_ID',
    !API_TOKEN && 'CLOUDFLARE_API_TOKEN',
  ].filter(Boolean);

  throw new Error(
    `Missing ${missing.join(' and ')}. Embedding requires Workers AI credentials.\n` +
      'Locally: add them to .env.\n' +
      'In CI: add them as GitHub repository secrets.'
  );
}

export const EMBED_MODEL = '@cf/baai/bge-m3';
export const EMBED_DIMENSIONS = 1024;

/**
 * The model's 60,000-token ceiling applies to the WHOLE batch, not to each
 * text -- a fixed row count is therefore not a safe unit, and a first attempt
 * at 100 rows blew past it at 92,000 tokens.
 *
 * Measured against real catalog text, Cloudflare bills this model at roughly
 * 1.23 tokens per character (74,444 chars was reported as 91,900 tokens; 38,843
 * chars passed). That is far denser than the ~4 chars/token rule of thumb for
 * English, so the budget is expressed in characters, which is the only unit
 * this side can actually count.
 *
 * 36,000 chars is about 44,000 tokens -- a 25% margin under the ceiling.
 */
export const MAX_BATCH_CHARS = 36_000;

/** A second bound so short rows cannot produce an absurdly long array. */
export const MAX_BATCH_ROWS = 100;

/**
 * Bounds any single text, so one pathological row cannot exceed the ceiling on
 * its own and wedge the run. 8,000 chars is ~10,000 tokens; the longest row
 * measured in the catalog was 3,067.
 */
export const MAX_TEXT_CHARS = 8_000;

const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBED_MODEL}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Splits items into batches that respect both the character budget and the row
 * cap. An item larger than the whole budget still gets its own batch rather
 * than looping forever -- MAX_TEXT_CHARS is what keeps that case sendable.
 */
export function chunkByBudget<T>(items: T[], sizeOf: (item: T) => number): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let size = 0;

  for (const item of items) {
    const itemSize = sizeOf(item);
    const wouldOverflow = size + itemSize > MAX_BATCH_CHARS || current.length >= MAX_BATCH_ROWS;

    if (current.length > 0 && wouldOverflow) {
      batches.push(current);
      current = [];
      size = 0;
    }

    current.push(item);
    size += itemSize;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

/** A 4xx that is not a rate limit will fail identically on every retry. */
class PermanentError extends Error {}

/** The model's hard ceiling, quoted back to us in the overflow error. */
const MAX_CONTEXT_TOKENS = 60_000;

/**
 * Cloudflare reports the real token count when a batch overflows:
 *   "Max context reached 135630 tokens but model supports only 60000"
 * That number is worth more than any local estimate -- see partsNeeded.
 */
export function parseContextOverflow(message: string): number | null {
  const m = /Max context reached (\d+) tokens/.exec(message);
  return m ? Number(m[1]) : null;
}

/**
 * How many pieces an overflowing batch must be cut into.
 *
 * Splitting blindly in half would need up to three rounds for a batch at 3x the
 * ceiling. The error already states the true size, so one division gets it
 * right the first time. The 1.3 margin covers the fact that tokens are not
 * evenly distributed across a batch -- one row can carry far more than its
 * share.
 */
export function partsNeeded(reportedTokens: number, limit = MAX_CONTEXT_TOKENS): number {
  return Math.max(2, Math.ceil((reportedTokens / limit) * 1.3));
}

/** Splits into `parts` contiguous groups, preserving order. */
function split<T>(items: T[], parts: number): T[][] {
  const perPart = Math.ceil(items.length / parts);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perPart) out.push(items.slice(i, i + perPart));
  return out;
}

/**
 * Embeds a batch, cutting it down when it overflows the context window.
 *
 * Predicting the token count locally does not work: measured against real
 * catalog rows the ratio swings from 1.2 to 3.8 tokens per character depending
 * on script and content, so any character or byte budget is either wasteful or
 * wrong. Reacting to the reported size is exact and needs no calibration.
 */
export async function embedAdaptive(texts: string[]): Promise<number[][]> {
  try {
    return await embedBatch(texts);
  } catch (err) {
    const reported = parseContextOverflow(String(err));

    // Not an overflow, or already down to one row that cannot be cut further --
    // MAX_TEXT_CHARS is what keeps that second case from happening at all.
    if (reported === null || texts.length === 1) throw err;

    const groups = split(texts, partsNeeded(reported));
    process.stdout.write(`\n     ↳ ${reported} tokens over ceiling, splitting into ${groups.length}... `);

    const out: number[][] = [];
    for (const g of groups) out.push(...(await embedAdaptive(g)));
    return out;
  }
}

/**
 * Embeds a batch, retrying transient failures with backoff. Throws only once
 * every attempt is spent, so the caller can record the batch as failed rather
 * than skipping it silently.
 */
export async function embedBatch(texts: string[], retries = 3): Promise<number[][]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: texts }),
      });

      if (!res.ok) {
        const detail = `Workers AI returned status ${res.status}: ${await res.text()}`;
        // Retrying an oversized batch just burns three round trips to reach the
        // same 400. Surface it immediately so the batch is recorded as failed.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new PermanentError(detail);
        }
        throw new Error(detail);
      }

      const json = (await res.json()) as {
        success: boolean;
        errors?: unknown[];
        result?: { data?: number[][] };
      };

      if (!json.success || !json.result?.data) {
        throw new Error(`Workers AI error: ${JSON.stringify(json.errors ?? json)}`);
      }

      const vectors = json.result.data;

      // A short batch would silently misalign vectors with their comics, which
      // is unrecoverable once written. Refuse rather than store a mismatch.
      if (vectors.length !== texts.length) {
        throw new Error(`Expected ${texts.length} vectors, got ${vectors.length}`);
      }
      if (vectors[0]?.length !== EMBED_DIMENSIONS) {
        throw new Error(
          `Expected ${EMBED_DIMENSIONS} dimensions, got ${vectors[0]?.length}. ` +
            'The column and the RPC both declare 1024.'
        );
      }

      return vectors;
    } catch (err) {
      if (err instanceof PermanentError || attempt === retries) throw err;
      const backoff = attempt * 2000;
      console.warn(`    ⚠️  Attempt ${attempt}/${retries} failed, retrying in ${backoff}ms — ${err}`);
      await sleep(backoff);
    }
  }

  throw new Error('unreachable');
}
