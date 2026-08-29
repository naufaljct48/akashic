# 📜 Product Requirements Document (PRD)

> [!WARNING]
> **This is the original pre-implementation spec, not a description of the app.**
> It specifies Next.js 16 App Router, the Vercel AI SDK and RSC; the shipped app
> is a Vite + React 19 SPA with no router and no Vercel AI SDK. Treat it as the
> historical brief — read `CLAUDE.md` and the code for what actually exists.
>
> What this document called for and the build now has: `pgvector` + HNSW hybrid
> search is live, over ~17,900 ingested titles. What differs: embeddings are
> `@cf/baai/bge-m3` at 1024 dimensions on Cloudflare Workers AI, not
> `text-embedding-3-small` at 1536; and there is no conversational/RAG chat
> agent — ranking is one stateless call per query.


## Project Name: **Akashic Dex** (Alternative: *Akashic*)
> **Tagline:** *The All-Knowing Comic Discovery & Semantic Recommendation Engine for Manga, Manhwa, and Manhua.*

- **Type:** Open-Source Web Application
- **Version:** 1.0 (MVP)
- **Status:** Draft / Ready for Implementation
- **Tech Stack:** Next.js 16 (App Router, Turbopack, React 19, TS), Tailwind CSS v4 + Shadcn/UI, Supabase (PostgreSQL + `pgvector`), Vercel AI SDK v7

---

## 1. Executive Summary & Problem Statement

### 1.1 Background & Problem
1. **Recommendation Paralysis:** Pembaca komik Asia (Manga Jepang, Manhwa Korea, Manhua China) sering terjebak dalam siklus kehabisan bacaan karena algoritma rekomendasi platform konvensional hanya berbasis popularitas/genre kasar.
2. **Keterbatasan Filter Konvensional:** Filter standar (Action, Fantasy, Romance) tidak mampu menangkap detail *sub-tropes* atau *narrative nuances* (contoh: *"MC licik/manipulatif tapi bukan edgelord"*, *"Murim non-reinkarnasi"*, *"Kingdom building realistis tanpa harem"*).
3. **Fragmentasi Data:** Sinopsis, tag, tropes, dan status tersebar di berbagai platform tanpa adanya *conversational discovery assistant* yang memahami preferensi pembaca dalam bahasa alami (natural language).

### 1.2 Solution & Objective
Membangun **Akashic Dex**, platform katalog dan *conversational discovery engine* open-source yang menggabungkan:
- **Basis Data Terstruktur:** Agregasi ribuan metadata komik dari API publik (AniList / MangaDex).
- **Hybrid Search Engine:** Kombinasi *full-text search* (metadata filter) dan *vector semantic search* (`pgvector`).
- **AI Recommendation Assistant (RAG):** Agen percakapan yang memahami konteks bacaan pengguna dan memberikan rekomendasi relevan disertai alasan (*match rationale*).

---

## 2. Branding & Naming Analysis

| Nama | Vibe & Kelebihan | Kekurangan | Rekomendasi |
| :--- | :--- | :--- | :--- |
| **Akashic** | Elegan, mistis, merujuk pada *Akashic Records* (arsip semesta). Sangat *sleek* dan *clean*. | Kurang langsung mencerminkan bahwa ini adalah ensiklopedia/katalog komik bagi orang awam. | Cocok jika ingin branding ala SaaS AI modern serba guna. |
| **Akashic Dex** | Menggabungkan konsep *Akashic* + *Dex* (seperti MangaDex / Pokédex). Komunitas wibu langsung paham bahwa ini direktori/katalog pintar. | Nama sedikit lebih panjang (2 kata). | **⭐ Recommended (Pilihan Utama)** untuk branding open-source komik. |

> **Keputusan Nama:** **`Akashic Dex`** (dengan domain/repo: `akashic-dex` atau `akashic.app`).

---

## 3. User Persona & Use Cases

| Persona | Problem & Kebutuhan | Contoh Prompt Percakapan |
| :--- | :--- | :--- |
| **The Trope Specialist** | Mencari *tropes* spesifik yang tidak ada di filter genre standar. | *"Cariin manhwa murim yang MC-nya beneran jenius dari kecil (bukan regresi/isekai) dan tone-nya dark realistis."* |
| **The "Vibe Matcher"** | Baru tamat membaca satu judul dan ingin cerita dengan dinamika serupa. | *"Gw baru namatin The Greatest Estate Developer, ada komik lain yang MC-nya licik, ekspresif, dan komedinya pecah gak?"* |
| **The Constraint Reader** | Punya batasan waktu / preferensi teknis membaca (status, chapter). | *"Pengen manga psychological horror yang udah tamat, chapter di bawah 60, dan plot twist-nya mindblowing."* |
| **The Blind Explorer** | Bosan dengan komik mainstream, mencari *hidden gem*. | *"Rekomendasiin 3 manhwa underrated genre fantasy politik yang rilis 2-3 tahun terakhir dengan art style top tier."* |

---

## 4. Product Scope

### 4.1 In-Scope (MVP V1)
1. **Guest-First Discovery Engine:**
   - Semua pengunjung (guest) dapat langsung menggunakan AI Chatbot dan browsing katalog tanpa wajib login.
   - Proteksi rate limiting: 10 prompt / hari / user (IP-based untuk guest, User ID-based untuk authenticated).
2. **Authentication & User Profile (Google OAuth via Supabase Auth):**
   - 1-Click Login menggunakan Google OAuth.
   - Bookmark & Personal Library ("Favorit", "Sedang Baca", "Rencana Baca").
   - Riwayat percakapan AI tersimpan lintas perangkat.
   - Fitur Sync MyAnimeList (MAL) username untuk mengecualikan judul yang sudah tamat dibaca.
3. **Curated Comic Directory:**
   - Katalog Manga, Manhwa, Manhua dengan data tersinkronisasi dari **AniList GraphQL API** dan skor dari **MAL / Jikan API** (Judul, Format, Status, Sinopsis, Genre, Tropes berbobot, Cover URL, Chapter Count, Rating).
4. **Hybrid RAG Recommendation Chat:**
   - Antarmuka chat interaktif dengan streaming response.
   - Ekstraksi filter otomatis oleh LLM (tipe, status, genre) + semantic similarity search ke `pgvector`.
5. **Interactive Match Cards:**
   - Kartu komik hasil rekomendasi AI dengan preview cover, badge format, skor, dan alasan rekomendasi (*match reason*).
6. **Exploration & Filter Catalog UI:**
   - Halaman katalog publik dengan filter konvensional (Genre, Type, Status) & search bar.
7. **Data Ingestion Script:**
   - CLI/Worker script untuk seeding data awal dari AniList GraphQL API (Top 5.000–10.000 komik dengan `idMal`) + auto-generate embeddings ke Supabase.

### 4.2 Out-of-Scope (Fase Lanjutan / Non-MVP)
- **Scraping Comick / Third-party Scanlators:** Disimpan untuk fase lanjutan agar pipeline MVP 100% stabil, legal, dan bebas kendala Cloudflare WAF.
- **In-app Comic Reader:** Platform *tidak* meng-host gambar bab komik demi kepatuhan hak cipta (fokus murni pada *Discovery & Recommendation Engine*).
- **Kompleksitas Akun Sosial:** Forum, direct messaging, atau review feed panjang (disimpan untuk V2).

---

## 5. Technical Architecture

```
                      ┌──────────────────────────────┐
                      │        User / Browser        │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │        Next.js App Router (React)        │
                │    - Tailwind CSS + Shadcn/UI (Dark)     │
                │    - Vercel AI SDK (Streaming UI)        │
                └──────────────┬───────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────────────┐
                │          Route Handlers / Actions        │
                │    - Intent & Metadata Extraction        │
                │    - Embedding Query Generator           │
                └──────────────┬───────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
  ┌─────────────────────────┐     ┌─────────────────────────────┐
  │   Embedding & LLM API   │     │      Supabase PostgreSQL    │
  │  - OpenAI / Gemini Embed│     │  - Relational: `comics`     │
  │  - LLM Chat Synthesis   │     │  - Vector: `pgvector` HNSW  │
  │                         │     │  - Hybrid Search RPC        │
  └─────────────────────────┘     └─────────────────────────────┘
```

### 5.1 Verified Modern Technology Stack Selection (Latest Stable)
- **Frontend & App Framework:** **Next.js 16** (App Router, Turbopack, React 19 Server Components, Strict TypeScript).
- **Styling & UI Kit:** **Tailwind CSS v4** + **Shadcn/UI** (Radix UI Primitives) + **Lucide Icons** (`v1.35+`).
- **Database & Vector Store:** **Supabase** (`@supabase/supabase-js v2.112+`, `@supabase/ssr v0.12+`, PostgreSQL 16 + `pgvector`).
- **AI Orchestration & Streaming:** **Vercel AI SDK** (`ai v7.0+`, `@ai-sdk/google v4.0+` / `@ai-sdk/openai v4.0+`).
- **Embedding Model:** `text-embedding-3-small` (1536 dim) atau `text-embedding-004` (768 dim).
- **Ingestion Worker & CLI:** `tsx` + AniList GraphQL Client.

---

## 6. Data Architecture & Database Schema (Supabase)

### 6.1 Relational & Vector Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE comic_type AS ENUM ('MANGA', 'MANHWA', 'MANHUA');
CREATE TYPE comic_status AS ENUM ('RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS');
CREATE TYPE comic_format AS ENUM ('MANGA', 'ONE_SHOT');

-- Main Comics Table
CREATE TABLE public.comics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INT UNIQUE NOT NULL, -- e.g. AniList ID
    slug TEXT UNIQUE NOT NULL,
    title_romaji TEXT NOT NULL,
    title_english TEXT,
    title_native TEXT,
    synonyms TEXT[] DEFAULT '{}',
    type comic_type NOT NULL DEFAULT 'MANGA',
    format comic_format DEFAULT 'MANGA',
    status comic_status NOT NULL DEFAULT 'RELEASING',
    synopsis TEXT,
    genres TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}', -- Tropes, narrative keywords
    total_chapters INT,
    release_year INT,
    average_score INT, -- 0 - 100
    popularity INT,
    cover_image_url TEXT,
    banner_image_url TEXT,
    country_of_origin VARCHAR(2), -- JP, KR, CN
    site_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Embeddings Table (1:1 with comics or chunked)
CREATE TABLE public.comic_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE UNIQUE NOT NULL,
    content_text TEXT NOT NULL, -- Formatted string: Title + Type + Genres + Tags + Synopsis
    embedding vector(1536) NOT NULL, -- Dimension based on embedding model
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create HNSW Vector Index for fast cosine similarity search
CREATE INDEX idx_comic_embeddings_hnsw 
ON public.comic_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- User Bookmarks Table
CREATE TABLE public.user_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'READING', -- 'FAVORITE', 'READING', 'PLAN_TO_READ', 'COMPLETED'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, comic_id)
);

-- Chat History Sessions Table
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for anonymous guest
    guest_ip TEXT, -- For guest tracking
    title TEXT DEFAULT 'New Conversation',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Daily Rate Limiter Table
CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- user_id (UUID) or guest IP hash
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    prompt_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (identifier, request_date)
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Public can read comics and embeddings
CREATE POLICY "Allow public read access on comics" ON public.comics FOR SELECT USING (true);
CREATE POLICY "Allow public read access on comic_embeddings" ON public.comic_embeddings FOR SELECT USING (true);

-- User bookmarks: only owner can read/write
CREATE POLICY "Users manage own bookmarks" ON public.user_bookmarks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat sessions: owner can manage, guest sessions readable by creator session
CREATE POLICY "Users manage own chat sessions" ON public.chat_sessions
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Full text search indexes for keywords
CREATE INDEX idx_comics_genres ON public.comics USING GIN (genres);
CREATE INDEX idx_comics_tags ON public.comics USING GIN (tags);
CREATE INDEX idx_comics_type ON public.comics (type);
CREATE INDEX idx_comics_status ON public.comics (status);
```

### 6.2 Hybrid Search Function (RPC)

```sql
CREATE OR REPLACE FUNCTION match_comics_hybrid(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_type comic_type DEFAULT NULL,
    filter_status comic_status DEFAULT NULL,
    filter_genres text[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title_romaji TEXT,
    title_english TEXT,
    type comic_type,
    status comic_status,
    genres TEXT[],
    tags TEXT[],
    synopsis TEXT,
    cover_image_url TEXT,
    average_score INT,
    total_chapters INT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title_romaji,
        c.title_english,
        c.type,
        c.status,
        c.genres,
        c.tags,
        c.synopsis,
        c.cover_image_url,
        c.average_score,
        c.total_chapters,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM public.comic_embeddings ce
    JOIN public.comics c ON c.id = ce.comic_id
    WHERE
        (filter_type IS NULL OR c.type = filter_type)
        AND (filter_status IS NULL OR c.status = filter_status)
        AND (filter_genres IS NULL OR c.genres @> filter_genres)
        AND (1 - (ce.embedding <=> query_embedding)) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

---

## 7. RAG & Recommendation Pipeline Workflow

```
1. User Message
   └─► "Gw pengen manhwa murim yang MC-nya jahat/licik tapi bukan regresi"

2. Query Decomposition (LLM Router / Tool Call)
   ├─► Filters: { type: 'MANHWA', genres: ['Action', 'Martial Arts'] }
   ├─► Semantic Query: "murim villainous cunning mastermind protagonist non-regression authentic martial arts"
   └─► Embedding Generator -> Vector [1536 float]

3. Hybrid Retrieval (Supabase RPC)
   └─► Execute `match_comics_hybrid` -> Returns top 5-10 candidate comics

4. Response Synthesis (LLM Agent)
   └─► Context injection: Data kandidat (Judul, Sinopsis, Tags, Skor)
   └─► Stream response: Penjelasan detail mengapa komik tersebut cocok, disertai UI Match Cards.
```

---

## 8. User Interface & Experience Specifications

### 8.1 Key Screens & Components
1. **Discovery Chat View (Home):**
   - Clean dark-mode aesthetic (slate/zinc palette + subtle purple/cyan neon accent).
   - *Prompt Suggestions Bar*: Quick chips seperti *"Best Regression Manhwa"*, *"Dark Psychological Manga"*, *"Cunning MC like Lloyd"*.
   - *Streaming Bubble Chat*: Respon percakapan instan dari AI.
2. **Interactive Recommendation Card:**
   - Cover thumbnail + format badge (`MANHWA` / `MANGA` / `MANHUA`).
   - Title (English & Romaji), Chapter count, Rating score badge.
   - Trope pills (e.g., `Cunning MC`, `Murim`, `No Harem`).
   - "Why AI Picked This" highlight block.
   - Quick action: "Add to Bookmarks" / "View Details" / "External Source Link".
3. **Catalog & Search Explorer:**
   - Grid layout dengan faceted filters (Type, Status, Country, Score Slider, Genre Selector).
   - Fast keyword search dengan instant suggestions.
4. **Comic Detail Modal / Page:**
   - Extended synopsis, similar titles recommendation carousel, complete tag tree, character highlights (if available).

---

## 9. Non-Functional Requirements (NFR)

1. **Performance & Latency:**
   - AI response streaming mulai muncul dalam $< 1.5$ detik.
   - Vector query execution time di Supabase $< 100\text{ ms}$ (menggunakan HNSW index).
2. **Cost Optimization:**
   - Menyimpan *hash embedding query* untuk menghindari embedding ulang prompt yang identik.
   - Prompt context disederhanakan (hanya mengirim top 5 candidates dengan ringkasan sinopsis).
3. **Open-Source Readiness & DX (Developer Experience):**
   - 1-Click setup via Supabase migrations (`supabase db push` / `schema.sql`).
   - Script ingestion otomatis dengan mock data sample untuk local testing tanpa API key berbayar.
   - Format `.env.example` yang rapi dan dokumentasi setup langkah-demi-langkah.

---

## 10. Phased Implementation Roadmap

1. **Phase 1: Database & Data Pipeline**
   - Setup schema Supabase + `pgvector` extension + HNSW index.
   - Buat ingestion script (`scripts/ingest-anilist.ts`) untuk fetch 5.000+ komik terpopuler.
   - Pipeline embedding otomatis untuk synopsis + tags.
2. **Phase 2: RAG & Hybrid Retrieval Engine**
   - Buat Supabase RPC `match_comics_hybrid`.
   - Setup Vercel AI SDK route handler dengan function calling / structured query extraction.
3. **Phase 3: Frontend & Modern UI**
   - Inisialisasi Next.js 15 (App Router) + Tailwind CSS + Shadcn/UI.
   - Implementasi Discovery Chat interface & Interactive Comic Match Cards.
   - Implementasi Catalog Explorer & Filter page.
4. **Phase 4: Open-Source Polish & Deployment**
   - Setup `.env.example`, Supabase Seed data script, dan `README.md` tutorial.
   - Deploy live demo ke Vercel + Supabase Cloud.

---

## 11. Success Metrics & Verification Criteria

- **Accuracy of Match:** AI merekomendasikan komik yang minimal 80% memenuhi kriteria semantik spesifik dari user.
- **Data Coverage:** Minimum 3.000 judul terpopuler (kombinasi Manga, Manhwa, Manhua) berhasil terindeks pada rilis MVP.
- **Zero Hallucination on Titles:** Judul dan status komik yang disebut oleh AI 100% berasal dari database `comics` di Supabase.
