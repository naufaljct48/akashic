/**
 * Write a value into `app_secrets`, the table the ai-curator Edge Function
 * reads its provider key from.
 *
 * The AI provider key must never be an app env var (there is no VITE_AI_API_KEY
 * and there must never be one), so it has to get into the database somehow.
 * Doing it here rather than by hand in the SQL editor keeps the key out of
 * query history, and rotating it is one command.
 *
 *   bun scripts/set-secret.ts AI_API_KEY sk-or-v1-...
 *   bun scripts/set-secret.ts --list
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL (see CLAUDE.md).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('[set-secret] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

/** Values are secrets — print shape, never content. */
const redact = (v: string) =>
  v.length <= 12 ? `${v.slice(0, 2)}…(${v.length} chars)` : `${v.slice(0, 8)}…${v.slice(-4)} (${v.length} chars)`;

const [key, ...rest] = process.argv.slice(2);

if (!key || key === '--list') {
  const res = await fetch(`${url}/rest/v1/app_secrets?select=key,value,updated_at&order=key`, { headers });
  if (!res.ok) {
    console.error('[set-secret] list failed:', res.status, await res.text());
    process.exit(1);
  }
  for (const row of await res.json()) console.log(row.key.padEnd(16), redact(row.value), ' ', row.updated_at);
  process.exit(0);
}

const value = rest.join(' ');
if (!value) {
  console.error('[set-secret] usage: bun scripts/set-secret.ts <KEY> <VALUE>');
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/app_secrets?on_conflict=key`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
});

if (!res.ok) {
  console.error('[set-secret] write failed:', res.status, await res.text());
  process.exit(1);
}

console.log(`[set-secret] ${key} = ${redact(value)}`);
