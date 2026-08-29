import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Comma-separated allowlist, e.g. "https://akashic.vercel.app,http://localhost:5173".
// Unset = allow any origin (CORS is not a real gate anyway; the rate limiter below is).
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const MAX_DAILY_PROMPTS = Number(Deno.env.get('MAX_DAILY_PROMPTS') || '10');

/** Retrieval hands over a wide pool; the model does the actual discriminating. */
const MAX_CANDIDATES = 24;

function corsHeaders(origin: string | null) {
  const allow =
    ALLOWED_ORIGINS.length === 0 ? '*' : ALLOWED_ORIGINS.includes(origin || '') ? origin! : 'null';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Atomic daily counter via bump_rate_limit RPC. Fails open if the DB is unreachable. */
async function withinRateLimit(req: Request): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return true;

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  try {
    const res = await fetch(`${url}/rest/v1/rpc/bump_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_identifier: await hashIp(ip), p_max: MAX_DAILY_PROMPTS }),
    });
    if (!res.ok) return true;
    return (await res.json()) === true;
  } catch {
    return true;
  }
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.slice(0, max).replace(/[\x00-\x1F\x7F]/g, '').trim() : '';

const num = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(Math.trunc(v), max)) : null;

/**
 * Only whitelisted, length-clamped fields reach the model — no free-form LLM
 * proxying. The numeric fields matter as much as the prose: without chapters,
 * status and year the model cannot honour "completed, under 60 chapters".
 */
function sanitizeCandidates(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_CANDIDATES).map((c: any) => ({
    id: str(c?.id, 64),
    title: str(c?.title, 120),
    type: str(c?.type, 12),
    character: str(c?.character, 80),
    status: str(c?.status, 20),
    year: num(c?.year, 2999),
    chapters: num(c?.chapters, 99999),
    score: num(c?.score, 100),
    genres: str(c?.genres, 160),
    tags: str(c?.tags, 260),
    synopsis: str(c?.synopsis, 400),
  }));
}

/** Fetch secret from Deno.env or fallback to secure Postgres app_secrets table */
async function getSecret(key: string, fallback: string = ''): Promise<string> {
  const envVal = Deno.env.get(key);
  if (envVal) return envVal;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return fallback;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_app_secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_key: key }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return typeof data === 'string' && data ? data : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The old instruction was a single line ("select 6-8 best matching titles"),
 * which gave the model no domain footing and no way to honour hard constraints —
 * so it ranked on genre overlap and returned confident, irrelevant picks.
 *
 * This spells out the vocabulary the audience actually uses, the difference
 * between the three formats, and the rule that a stated exclusion outranks
 * similarity. It also permits returning fewer titles rather than padding.
 */
function buildSystemInstruction(locale: 'id' | 'en'): string {
  const shared = `
You are the curator for Akashic Dex, a discovery engine for Korean manhwa,
Chinese manhua and Japanese manga. You know this medium deeply: its serialised
webtoon format, its scanlation-era English titles, and the trope vocabulary
readers use to describe it.

DOMAIN VOCABULARY (use it when you reason, do not lecture the user about it):
- murim / wuxia / xianxia: martial-arts worlds with sects, qi cultivation and
  martial ranks. Korean "murim" is usually grounded and political; Chinese
  "xianxia" trends immortal and cosmic.
- regression: the protagonist dies or fails, then restarts at an earlier point
  keeping their memories. Distinct from reincarnation (reborn as someone else)
  and from isekai / transmigration (pulled into another world or into a novel).
- system / status window / leveling: a game-like interface only the protagonist
  sees, awarding stats and skills. Common in hunter-and-gate stories.
- hunter / gate / dungeon: modern-day portals spawning monsters, with ranked
  awakened hunters — the Solo Leveling lineage.
- tower climbing, kingdom building, estate management, academy, villainess,
  returner, necromancer, cunning or scheming protagonist, revenge, apocalypse.

CHARACTER KNOWLEDGE: when the user names a character rather than a title
(Lloyd Frontera, Chung Myung, Kim Dokja, Sung Jinwoo, Zhuo Fan, Guts, Johan
Liebert), recognise who they are and which series they belong to, and read the
request as "the vibe of that character", not as a literal keyword.

THE "character" FIELD: some candidates carry one. It means AniList's character
index confirmed that named person actually appears in that title — it is ground
truth, not a guess, and it is knowledge you cannot get from the synopsis. When
the user asks about a character ("manhwa yg mc nya Lloyd", "the one with Chung
Myung"), a candidate whose "character" field matches IS the answer: rank it
first and name the character in its reason. Users misspell names constantly, so
treat a near-match ("llyod" / "Lloyd") as a match.

HARD RULES:
1. Pick ONLY from the supplied candidate list, and return each id EXACTLY as
   given. Never invent a title or an id.
2. An explicit exclusion always outranks similarity. "no romance" / "minim
   romance", "not regression", "already completed", "under 60 chapters",
   "manhwa only" are filters, not preferences — drop any candidate that
   violates one, even if it is otherwise the closest match.
3. Use the status, chapters, year and score fields to check those constraints.
4. Rank by how well a title satisfies the SPECIFIC thing asked for — the
   protagonist's temperament, the tone, the structure — not by popularity or by
   how many genres happen to overlap.
5. Return 6 to 12 matches. If fewer genuinely fit, return fewer; a short honest
   list beats a padded one. Never pad with unrelated popular titles.
6. When the user asks for one specific thing (a named character, a named title)
   and NO candidate has it, return at most 3 nearest alternatives and say in the
   summary that the exact one was not found. Returning eight loosely-related
   titles under an apology is the worst possible answer — it buries the failure
   and wastes the reader's time.
7. Each "reason" is one concrete sentence naming what actually matches: the
   trope, the protagonist's behaviour, the structure. No generic filler like
   "a great read with an interesting story".
8. "summary" is one or two sentences describing what you selected for and,
   where relevant, what you deliberately excluded.

Respond with JSON ONLY, no markdown fence:
{"summary": "...", "matches": [{"id": "...", "reason": "..."}]}`.trim();

  return locale === 'en'
    ? `${shared}\n\nWrite "summary" and every "reason" in English.`
    : `${shared}\n\nTulis "summary" dan seluruh "reason" dalam Bahasa Indonesia yang natural dan santai (boleh pakai "kamu"), bukan terjemahan kaku.`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }

  try {
    const body = await req.json();
    const query = str(body?.query, 160);
    const candidates = sanitizeCandidates(body?.candidates);
    const locale = body?.locale === 'en' ? 'en' : 'id';

    if (!query || candidates.length === 0) {
      return json({ error: 'query and candidates are required' }, 400, origin);
    }

    if (!(await withinRateLimit(req))) {
      return json({ error: 'Daily AI quota exceeded' }, 429, origin);
    }

    // Three providers, tried in order. An attempt is (base, key, model) rather
    // than a bare model id because the chain crosses provider boundaries — the
    // whole point is surviving one of them being down, which is not hypothetical:
    // b.ai has answered 503 for this entire session.
    const csv = (v: string) => v.split(',').map((m) => m.trim()).filter(Boolean);

    const providers = [
      {
        key: await getSecret('AI_API_KEY'),
        base: await getSecret('AI_BASE_URL', 'https://api.b.ai/v1'),
        models: csv(await getSecret('AI_MODEL', 'deepseek-v4-flash')),
      },
      {
        key: await getSecret('OPENROUTER_API_KEY'),
        base: await getSecret('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
        // Free models are rate-limited upstream by whoever hosts them, so one id
        // is a single point of failure — two of them is not redundancy for its
        // own sake, it is what makes the free tier usable at all.
        models: csv(
          await getSecret('OPENROUTER_MODELS', 'minimax/minimax-m3:free,minimax/minimax-m2.7:free')
        ),
      },
      {
        key: await getSecret('MISTRAL_API_KEY'),
        base: await getSecret('MISTRAL_BASE_URL', 'https://api.mistral.ai/v1'),
        models: csv(await getSecret('MISTRAL_MODELS', 'mistral-small-2603')),
      },
    ];

    // A provider with no key configured is skipped, not an error: this has to
    // stand up with only the primary set.
    const attempts = providers.flatMap((p) =>
      p.key ? p.models.map((model) => ({ base: p.base, key: p.key, model })) : []
    );

    if (attempts.length === 0) {
      return json({ error: 'No AI provider configured on server' }, 500, origin);
    }

    const systemInstruction = buildSystemInstruction(locale);
    const userContent = `User Query: "${query}"\nCandidates:\n${JSON.stringify(candidates)}`;
    const candidateIds = new Set(candidates.map((c) => c.id));

    // The browser aborts at 45s (see deepseek.service.ts). Walking the chain
    // past that is pure waste — the answer arrives after nobody is listening —
    // and measured models range from 2s to 69s, so the budget has to be
    // enforced here rather than hoped for.
    const deadline = Date.now() + 40_000;
    let lastFailure = 'no attempt made';

    for (const attempt of attempts) {
      const budget = Math.min(25_000, deadline - Date.now());
      if (budget < 2_000) {
        lastFailure = `${lastFailure}; out of time before ${attempt.model}`;
        break;
      }

      // One try around the whole attempt, including the body read: an aborted
      // request can clear the headers and then throw while streaming, which
      // outside a catch kills the entire chain instead of advancing it.
      try {
        const aiRes = await fetch(`${attempt.base}/chat/completions`, {
          method: 'POST',
          signal: AbortSignal.timeout(budget),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${attempt.key}`,
            // OpenRouter attribution. Ignored by other providers.
            'HTTP-Referer': 'https://akashic-lime.vercel.app',
            'X-Title': 'Akashic Dex',
          },
          body: JSON.stringify({
            model: attempt.model,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userContent },
            ],
            response_format: { type: 'json_object' },
            // Reasoning models bill their thinking against max_tokens. A
            // 24-candidate pool burned all 3000 on reasoning and returned an
            // empty `content`, so every full-size query silently fell back to
            // the deterministic matcher. Leave headroom for the answer itself.
            max_tokens: 8000,
            temperature: 0.3,
          }),
        });

        if (!aiRes.ok) {
          lastFailure = `${attempt.model}: upstream ${aiRes.status}`;
          continue;
        }

        const payload = await aiRes.json();
        const content = payload?.choices?.[0]?.message?.content;

        // Everything below is a failure the client cannot tell apart from a
        // success, which is exactly why it has to be caught here. A 200 carrying
        // an unusable body would end the chain and strand the user on the
        // deterministic fallback, with a working model one position away.
        if (!content) {
          // What a reasoning model returns when it spends the budget thinking.
          lastFailure = `${attempt.model}: empty content`;
          continue;
        }

        // Truncated JSON — measured on a model that burnt 8.9k tokens reasoning
        // and hit finish_reason=length mid-object.
        const parsed = JSON.parse(content) as { matches?: Array<{ id?: string }> };

        // Smaller models invent plausible-looking ids. The client silently drops
        // any id it cannot find, so an all-hallucinated answer reaches the user
        // as an empty result with no error anywhere. We hold the candidate list
        // here — check it here.
        const real = (parsed.matches || []).filter((m) => m?.id && candidateIds.has(m.id)).length;
        if (real === 0) {
          lastFailure = `${attempt.model}: no valid candidate ids`;
          continue;
        }

        return json(payload, 200, origin);
      } catch (err) {
        lastFailure = `${attempt.model}: ${err}`;
        continue;
      }
    }

    console.error('[ai-curator] every provider failed:', lastFailure);
    return json({ error: `Upstream AI error (${lastFailure})` }, 502, origin);
  } catch (err) {
    console.error('[ai-curator]', err);
    return json({ error: 'Internal error' }, 500, origin);
  }
});
