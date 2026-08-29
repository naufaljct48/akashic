# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **global manga / manhwa / manhua readers, English-first** (Bahasa Indonesia is a
full secondary locale, not a fallback). They arrive between series — they just finished
something and are out of things to read — and conventional platform recommendations fail
them because those rank by popularity and coarse genre.

Confirmed reader jobs, from the PRD personas:

- **Trope specialist** — wants a sub-trope that no genre filter exposes ("murim, MC genuinely
  a prodigy from childhood, not a regressor, dark realistic tone").
- **Vibe matcher** — just finished one title, wants the same narrative dynamic, not the same tags.
- **Constraint reader** — has hard limits (finished status, chapter count ceiling, era).
- **Blind explorer** — bored of mainstream, hunting hidden gems.

Everyone is a guest. There is no logged-in user to design for.

## Product Purpose

Akashic Dex is a discovery and recommendation engine for Asian comics: ask in natural
language, get titles back with a stated **match reason**. It catalogs and recommends — it
never hosts chapter images, deliberately, for copyright compliance.

Success is the reader leaving with something to read that a genre filter would not have
surfaced, without signing up for anything.

## Positioning

Two mechanisms a neighboring catalog site could not truthfully copy:

1. **Dual-path search behind one input.** Short, title-shaped queries hit PostgREST directly
   and return in tens of milliseconds. Nuanced, intent-shaped prompts route through candidate
   retrieval and an LLM re-rank. The reader never chooses a mode.
2. **The AI ranks, it never invents.** Every returned title exists in the catalog or in live
   AniList. The model reorders and explains; it cannot hallucinate a comic. When it returns
   nothing, deterministic fallback reasons take over — the AI path degrades, never fails.

Tropes and narrative nuance are the unit of search, not genres.

## Operating Context

- Single-page workspace, three tabs: **Discovery** (AI results plus live AniList trending /
  recently-updated / new-release feeds), **Catalog** (conventional filtering across genres,
  type, status, 300+ tropes), **Bookmarks** (saved library).
- Mobile-first PWA with a service worker; installable, top drawer plus sticky bottom nav on
  small screens, and a desktop workspace layout.
- `Ctrl+K` spotlight search is a primary path in, with full keyboard navigation.
- Titles are shareable by deep link (`?c=`); a shared link opens the inspector directly.
- Free, open-source (MIT), no signup, no paywall.

## Capabilities and Constraints

**Confirmed today**

- Catalog of **~6,600 real ingested titles** (user-confirmed; the in-app "1,000+" string is
  stale copy, not a smaller catalog). A daily GitHub Actions cron syncs trending releases.
- Data from AniList GraphQL with MyAnimeList cross-reference; some feeds are fetched live in
  the browser and never touch the database.
- Reading-status tracking: *Reading* (with a chapter counter), *Plan to Read*, *Completed*.
- "Surprise Me" gacha pick for high-scoring hidden gems.
- Bilingual ID / EN, dark and light theming.
- AI quota: **10 prompts per day per IP**, enforced server-side in the Edge Function. The
  client-side counter is display only.

**Durable constraints**

- **Guest-only is the product, deliberately.** No accounts, no OAuth, no cross-device sync,
  no MAL import. Local-only bookmarks are the feature — zero friction, no signup wall. Never
  design a logged-in state, an account menu, or a "sign in to save" prompt. The PRD's auth
  and MAL-sync sections are out of scope, not pending.
- **Persistence is localStorage**, so a reader's library is per-device and per-browser and can
  be lost. Any surface touching bookmarks has to be honest about that.
- **No in-app reader.** The product links out; it never displays chapter pages.
- A title can appear from the database (UUID id) or from live AniList (`anilist-<id>`), and
  those are distinct bookmark entries. This is a known seam, not a bug to design around.
- `ARCHITECTURE.md` and `PRD.md` describe a Next.js / RSC / pgvector design that does not
  exist. The shipped app is a Vite + React 19 SPA with keyword retrieval. Read code, not
  those docs.

## Brand Commitments

- Name: **Akashic Dex** (アキシック・デックス). Confirmed in the PRD over the bare "Akashic";
  *Dex* is the signal to comic readers that this is a directory.
- Tagline: *The All-Knowing Comic Discovery & Semantic Recommendation Engine for Manga,
  Manhwa, and Manhua.*
- Existing assets: `public/favicon.svg`, PWA manifest, in-app `AkashicLogo` component.
- Author: Naufal (github.com/naufaljct48). MIT licensed, open source.
- **Binding constraint volunteered by the user:** the elastic / spotlight search control and
  its modal are liked as they are and stay. The rest of the current interface reads to the
  user as generic AI-generated work and is open to replacement.

## Evidence on Hand

- Real, live catalog data — ~6,600 ingested titles, real cover art, real scores and chapter
  counts, real trending feeds. Screenshots and demos can use actual product data.
- Working public deployment on Vercel, real GitHub repo with real stars/forks badges.
- Real AI behavior: genuine match reasons, genuine sub-second direct search.

**Nothing else exists. Do not fabricate:** no users, no user counts, no testimonials, no
reviews, no press, no case studies, no revenue, no team, no pricing, no partnerships or
endorsements from AniList or MyAnimeList. There is no measured performance benchmark beyond
the "<80ms" direct-path claim already in the README — treat any new number as unbacked
unless it is measured first.

## Product Principles

1. **No signup, ever.** Every capability is reachable by a first-time guest on their first
   visit. Friction is the competitor.
2. **Never invent a title.** The AI re-ranks and explains real rows; it does not generate
   recommendations from nothing.
3. **Degrade, don't fail.** Every AI path has a deterministic fallback. A quota ceiling, a
   dead model, an empty result — the reader still gets a usable answer.
4. **The trope is the unit.** Search, filter, and explanation all work at the level of
   narrative nuance, not genre buckets.
5. **Discovery, not hosting.** The product ends at "here is what to read and why."

## Accessibility & Inclusion

- Full keyboard operation of search is an existing commitment: `Ctrl+K` to open, `↑ ↓` to
  navigate, `Enter` to select, `Esc` to close. Keep it.
- Dark and light both ship and both must be legible — theming runs on CSS custom properties,
  so hardcoded palette colors break one of the two.
- Bilingual ID / EN with real parity: the locale type forces every key to exist in both, and
  copy length differs between them.
- No product-specific standard has been established beyond these.
