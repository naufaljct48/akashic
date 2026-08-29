# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Bun is the runtime and package manager (`bun.lock` is authoritative; `package-lock.json` is stale).

```bash
bun install
bun run dev              # Vite dev server on :5173
bun run build            # tsc --noEmit + vite build
bun run test             # runs src/lib/supabase/filters.test.ts
bun run ingest:trending  # daily AniList sync (what CI runs)
bun run ingest:massive   # bulk catalog ingestion
bun run heal:covers      # backfill/repair cover_image_url
```

There is no linter and no test framework. `bun run test` executes a single plain-assertion file; add new checks as `bun <file>.test.ts` scripts in the same style. `tsc` strict + `noUnusedLocals`/`noUnusedParameters` is the de-facto lint — `bun run build` is the check that must pass.

Ingestion scripts need `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (not the `VITE_*` pair). Migrations in `supabase/migrations/` are not auto-applied; run them via the Supabase CLI/SQL editor.

## ⚠️ ARCHITECTURE.md is aspirational, not descriptive

`ARCHITECTURE.md` documents a Next.js 16 App Router / RSC / Zod / Result-pattern design that **does not exist in this repo**. The real app is a Vite + React 19 SPA: no router (tab state in `src/App.tsx`), no Zod, no server components, no `src/env.ts`. Only its Atomic Design folder convention (`ui/` → `molecules/` → `organisms/` → `templates/`) is real. Read code, not that doc.

## Architecture

Single-page React app; three tabs (`discovery` / `catalog` / `bookmarks`) switched by `useState` in [App.tsx](src/App.tsx), with catalog and bookmarks code-split via `React.lazy`. `vercel.json` rewrites everything to `index.html`.

**Data flows through three sources, and it matters which one a comic came from:**

1. **Supabase `comics` table** — the ingested catalog. Rows have UUID `id`.
2. **Live AniList GraphQL** ([anilist-live.service.ts](src/services/anilist-live.service.ts)) — trending/recent/new feeds and fallback title search, fetched straight from the browser. These synthesize `id: \`anilist-${item.id}\`` and never touch the DB. Bookmarks key on that string, so a live-sourced bookmark and its DB twin are different entries.
3. **The `ai-curator` Edge Function** — re-ranks DB/AniList candidates; it never introduces new titles.

### Search: two paths, one entry point

`searchComicsSemantic()` in [comic.service.ts](src/services/comic.service.ts) is the single search entry. `isSemanticIntent()` decides the path:

- **Direct-title path** (short query, no intent keywords) → one PostgREST query, no LLM. Falls back to live AniList if the catalog misses.
- **AI path** → `retrieveSemanticCandidates()` assembles ~30 candidates via a hand-maintained reference-title/keyword expansion dictionary, then [deepseek.service.ts](src/services/deepseek.service.ts) POSTs them to the Edge Function for ranking. If the AI returns nothing, `generateFallbackReason()` produces deterministic match reasons — **the AI path must always degrade, never throw**.

`comic_embeddings` + pgvector + an HNSW index exist in the schema, but nothing generates or queries embeddings. Retrieval is keyword-based today.

### AI secret & rate limiting

The AI provider key is deliberately **never** an app env var — there is no `VITE_AI_API_KEY`. It lives in [supabase/functions/ai-curator/index.ts](supabase/functions/ai-curator/index.ts), read from `Deno.env` with a fallback to a `get_app_secret` RPC. That function whitelists and length-clamps every field before it reaches the model (`sanitizeCandidates`), so it is not a general LLM proxy.

`src/services/rate-limit.service.ts` is a **display counter only** — localStorage is trivially reset. The enforced quota is the `bump_rate_limit` RPC in the Edge Function, keyed on a SHA-256 of the client IP, and it fails open when the DB is unreachable. Never move enforcement clientward.

### PostgREST filter escaping

Any user string interpolated into a `.or(...)` filter must go through `ilikePattern()` / `csArray()` from [filters.ts](src/lib/supabase/filters.ts). Raw commas, quotes, or `%` rewrite the query. The double-backslash escaping for `%`/`_` is deliberate (PostgREST strips one level on unquote) and is what `filters.test.ts` pins — don't "simplify" it.

Supabase queries use `(supabase.from('comics') as any)` because the hand-written `Database` types in `src/core/types/database.ts` don't satisfy the client's builder generics. Keep the cast at the query site rather than loosening the domain types in `src/core/types/comic.ts`.

## Conventions

- `@/` → `src/`.
- **Theming:** CSS custom properties in [index.css](src/index.css), toggled by a `dark`/`light` class on `<html>`. Write `bg-[var(--bg-surface)]`, not Tailwind palette colors, or light mode breaks. Accent is `#ff334b`.
- **i18n:** `src/core/i18n/locales/id.ts` defines the `Translations` type; `en.ts` is typed against it, so adding a key to one file forces the other. `locale` is threaded into services because AI summaries and fallback reasons are generated per-language.
- **Persistence is localStorage**, not Supabase: bookmarks (`akashic_user_bookmarks_v2`, with legacy-key migration in [bookmark.ts](src/core/types/bookmark.ts)), theme, locale, rate-limit display. The `user_bookmarks` table exists but the app doesn't use it; anon has no access to it.
- Services log with a `[serviceName.fnName]` prefix and return an empty/`null` result on error rather than throwing.

## CI

`.github/workflows/daily-sync.yml` runs `ingest:trending` at 00:00 UTC with the service-role secret. Deployment is Vercel (`bun run build` → `dist`).
