/**
 * PostgREST filter-string escaping.
 *
 * Values interpolated into `.or(...)` are parsed as filter syntax, so a raw
 * comma, parenthesis or quote from the search box breaks the query (or rewrites
 * it). Wrapping the value in double quotes makes those characters literal.
 *
 * `%` and `_` need TWO backslashes, not one: PostgREST strips one level when it
 * unquotes the value, and LIKE needs the surviving `\` to disable the wildcard.
 * Verified against the live REST API — a single backslash still matches "100 X"
 * when searching for "100%".
 */
function escapeValue(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, '\\\\$&');
}

/** Quoted `%value%` pattern for use with the `ilike` operator. */
export function ilikePattern(raw: string): string {
  return `"%${escapeValue(raw)}%"`;
}

/** Quoted single-element array literal for use with the `cs` (contains) operator. */
export function csArray(raw: string): string {
  return `{"${escapeValue(raw)}"}`;
}

/**
 * Multi-element array literal for `cs` / `ov`, e.g. `{"Romance","Ecchi"}`.
 *
 * supabase-js builds this for you when you pass an array to `.overlaps()`, but
 * not for `.not('genres', 'ov', ...)` — that third argument goes through raw, so
 * an unescaped genre containing a comma or quote would break out of the literal.
 */
export function pgArrayLiteral(values: string[]): string {
  return `{${values.map((v) => `"${escapeValue(v)}"`).join(',')}}`;
}
