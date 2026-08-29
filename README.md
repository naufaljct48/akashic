<div align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Akashic Dex Logo" />
  <h1>🌌 Akashic Dex (アキシック・デックス)</h1>
  <p><strong>AI-Powered Semantic Discovery, Recommendation Engine & Reading Tracker for Manga, Manhwa, & Manhua</strong></p>
  <p>
    <a href="https://github.com/naufaljct48/akashic/stargazers"><img src="https://img.shields.io/github/stars/naufaljct48/akashic?style=for-the-badge&color=ff334b" alt="Stars"></a>
    <a href="https://github.com/naufaljct48/akashic/network/members"><img src="https://img.shields.io/github/forks/naufaljct48/akashic?style=for-the-badge&color=6366f1" alt="Forks"></a>
    <a href="https://github.com/naufaljct48/akashic/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-emerald?style=for-the-badge" alt="License"></a>
    <a href="https://pwa.org"><img src="https://img.shields.io/badge/PWA-Ready-f59e0b?style=for-the-badge" alt="PWA Ready"></a>
  </p>
</div>

---

## 🌟 Key Features

- 🧠 **AI Semantic Reasoning:** Natural language intent analysis & trope curation (*"Cunning MC like Lloyd Frontera"*, *"Authentic non-regression Murim"*), with a multi-provider fallback chain so one provider being down does not take search with it.
- 🎯 **Vector Semantic Retrieval:** Every title carries a `bge-m3` embedding, so a description finds a story that never uses your words — *"raksasa yang memakan manusia di balik tembok"* returns Attack on Titan. Indonesian queries are translated before retrieval; measured recall@20 is 90%.
- 🎲 **Surprise Me (Gacha Recommendation):** One-click high-rated hidden gem picker ($\ge 7.8$ score) with animated reveal.
- 📚 **Personal Reading Status Tracker:** Track your journey with *Reading* (with custom chapter counter), *Plan to Read*, and *Completed* status filters.
- ⚡ **Dual-Path Instant Search (<80ms):** Direct keyword hits query PostgreSQL directly; nuanced prompts trigger the serverless AI semantic pipeline.
- 🔍 **Elastic Global Spotlight Search (`Ctrl+K`):** Real-time debounced finder across **17,900+ real titles** with keyboard navigation (`↑`, `↓`, `Enter`, `ESC`).
- 🔄 **Real-Time Live Chapter Sync:** Background AniList GraphQL queries ensure real-time chapter counts, release status, and official HD artwork.
- 🔒 **Serverless Edge Function Security:** AI API keys stay on a Supabase Edge Function that validates and clamps every request and enforces a server-side daily quota per IP.
- 📱 **Mobile-First PWA & Dual Navigation:** Full Progressive Web App support with service worker offline caching, top hamburger drawer, and sticky bottom navigation.
- 🌐 **Full Internationalization (i18n):** Instant switching between 🇮🇩 Bahasa Indonesia and 🇬🇧 English.
- 🌗 **Adaptive Dynamic Dark/Light Theming:** Linear-grade Obsidian/Electric Crimson palette with high contrast and silky 150ms transitions.
- ⏰ **24/7 Auto-Ingestion Cron:** GitHub Actions workflow automatically ingests fresh trending releases daily.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime & Tooling** | [Bun](https://bun.sh) (Fast JavaScript Runtime & Package Manager) |
| **Frontend Framework** | React 19 + Vite 6 + TypeScript (Strict Mode) |
| **Styling & UI** | Tailwind CSS v4 + Anton (display) + Plus Jakarta Sans (text), editorial print design system — tinted paper, process inks, halftone screen, no monospace |
| **Database** | Supabase Cloud + PostgreSQL 15 (GIN indexes on genres/tags; `pgvector` with an HNSW index over 17,900+ embeddings, live) |
| **Serverless Security** | Supabase Edge Functions (Deno Runtime) |
| **AI Intelligence** | Ranking: OpenRouter → Mistral → b.ai fallback chain (OpenAI-compatible REST). Embeddings & query translation: Cloudflare Workers AI (`@cf/baai/bge-m3`, `llama-3.1-8b-instruct`) |
| **Data Backbone** | AniList GraphQL API + MyAnimeList (MAL) Cross-Reference |
| **CI/CD & Automation** | GitHub Actions (Daily Ingestion Cron) + Vercel Deployment |

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/naufaljct48/akashic.git
cd akashic
bun install
```

### 2. Configure Environment
Create `.env` based on `.env.example`:
```env
# Client bundle (public by design — never put a secret here)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Ingestion scripts only
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The AI provider key is **not** an app env var — it lives in the Edge Function:

```bash
supabase secrets set AI_API_KEY=... ALLOWED_ORIGINS=https://akashic-dex.vercel.app
```

### 3. Run Development Server
```bash
bun run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start local Vite development server |
| `bun run build` | Compile TypeScript & generate optimized production chunks |
| `bun run preview` | Preview production build locally |
| `bun run ingest:massive` | Run bulk AniList GraphQL ingestion into Supabase |
| `bun run ingest:10k` | Year-partitioned catalog ingestion (AniList caps any single filter at 5,000 results) |
| `bun run embed:catalog` | Backfill `comic_embeddings`; resumable, skips rows that already have a vector |
| `bun run eval:recall` | Measure retrieval quality against a fixed query fixture (`--translate` for the production path) |
| `bun run ingest:trending` | Run daily automated sync for trending, new, and updated series |

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

Developed with ❤️ by [Naufal](https://github.com/naufaljct48).
