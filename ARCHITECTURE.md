# 🏛️ Akashic Dex — Architectural Standards & Senior Engineering Blueprint

Dokumen standar arsitektur dan konvensi penulisan kode untuk **Akashic Dex**. Dirancang dengan standar **Tier-S Senior Software Engineer**: *Clean Code, Minimalist, Atomic Design, Type-Safe, dan Scalable Open-Source Architecture*.

---

## 1. 📐 Prinsip Inti Arsitektur (Core Pillars)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           1. ATOMIC DESIGN                              │
│         Atoms (UI Primitives) ──► Molecules ──► Organisms ──► Views      │
├─────────────────────────────────────────────────────────────────────────┤
│                     2. SEPARATION OF CONCERNS (SoC)                     │
│    Data Layer (Supabase) ──► Service Layer ──► Hooks ──► Presentation   │
├─────────────────────────────────────────────────────────────────────────┤
│                        3. ZERO-ANY TYPE SAFETY                          │
│        Strict TypeScript + Zod Runtime Validation (Env & External Data) │
├─────────────────────────────────────────────────────────────────────────┤
│                   4. SERVER-FIRST (RSC HYGIENE)                         │
│  90% Server Components by default ──► 'use client' only for interactive │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. SOLID & Clean Code Rules
- **Single Responsibility Principle (SRP):** Satu file/fungsi hanya bertanggung jawab atas satu hal. UI tidak boleh berisi logic fetch database langsung; Route handler tidak boleh berisi query SQL mentah.
- **KISS & YAGNI:** Hindari *over-engineering* (jangan pasang library Redux/Zustand jika React Server Components + URL search params sudah menyelesaikan masalah state dengan lebih bersih).
- **Explicit over Implicit:** Nama variable, fungsi, dan type harus *self-documenting* (`formatComicScore` bukan `fScore` atau `fmt`).
- **Defensive & Resilient:** Semua network call eksternal (AniList, Jikan, OpenAI/Gemini) wajib di-wrap dengan `try-catch`, error logging, dan runtime validation via Zod.

---

## 2. 🗂️ Struktur Folder Standar (Feature-Driven + Atomic Design)

Struktur folder dibuat modular dan intuitif agar siapapun kontributor open-source bisa langsung paham dalam 30 detik:

```
akashic/
├── .env.example
├── README.md
├── ARCHITECTURE.md
├── PRD.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts / app/globals.css
│
├── scripts/                          # 🛠️ CLI & Ingestion Workers
│   ├── ingest-anilist.ts             # Seeder script (AniList GraphQL -> Supabase)
│   ├── generate-embeddings.ts        # Vector embedding worker
│   └── seed-mock-data.ts             # Local development sandbox seeder
│
├── supabase/                         # 🗄️ Database & Vector Migration
│   ├── migrations/
│   │   └── 20260901_init_schema.sql  # Schema, pgvector extension & RPCs
│   └── seed.sql
│
└── src/
    ├── env.ts                        # 🔒 Type-safe Environment Variables (Zod)
    │
    ├── app/                          # 🌐 Next.js 16 App Router (Orchestration Layer)
    │   ├── layout.tsx                # Root layout (Theme provider, Fonts, Metadata)
    │   ├── page.tsx                  # Home (Chat Discovery view)
    │   ├── catalog/
    │   │   ├── page.tsx              # Browse catalog with faceted filter
    │   │   └── [slug]/page.tsx       # Detail view per comic
    │   └── api/
    │       ├── chat/route.ts         # Vercel AI SDK streaming endpoint
    │       └── search/route.ts       # Hybrid search fallback endpoint
    │
    ├── components/                   # 🎨 Atomic UI Components
    │   ├── ui/                       # ⚛️ ATOMS: Primitive, stateless (Button, Badge, Input, Skeleton)
    │   │   ├── button.tsx
    │   │   ├── badge.tsx
    │   │   ├── dialog.tsx
    │   │   └── card.tsx
    │   │
    │   ├── molecules/                # 🧬 MOLECULES: Kombinasi 2-3 Atoms (TropePill, SearchInput, RatingBadge)
    │   │   ├── trope-pill.tsx
    │   │   ├── rating-stars.tsx
    │   │   ├── prompt-chip.tsx
    │   │   └── match-score-bar.tsx
    │   │
    │   ├── organisms/                # 🦠 ORGANISMS: Unit fungsional mandiri (ChatBox, ComicCard, FilterSidebar)
    │   │   ├── chat-container.tsx
    │   │   ├── chat-message-bubble.tsx
    │   │   ├── comic-card.tsx
    │   │   ├── comic-grid.tsx
    │   │   └── catalog-filter-bar.tsx
    │   │
    │   └── templates/                # 📄 TEMPLATES / SHELLS: Layout & Structural Wrapper
    │       ├── header.tsx
    │       ├── footer.tsx
    │       └── app-shell.tsx
    │
    ├── core/                         # 🧠 Domain Core (Types, Schemas, Constants)
    │   ├── constants/
    │   │   ├── comic-genres.ts       # Enum & tag taxonomies
    │   │   └── prompts.ts            # System prompts untuk RAG Recommendation Agent
    │   ├── schemas/
    │   │   ├── comic.schema.ts       # Zod schemas for Comic entity & filters
    │   │   └── ai-intent.schema.ts   # Zod schema for LLM structured query extraction
    │   └── types/
    │       ├── comic.ts              # TypeScript Domain Interfaces
    │       ├── database.ts           # Supabase Database generated types
    │       └── chat.ts               # Message & recommendation types
    │
    ├── lib/                          # 🔌 External Clients & Infrastructure
    │   ├── supabase/
    │   │   ├── client.ts             # Browser Supabase client
    │   │   └── server.ts             # Server / RSC Supabase client
    │   ├── ai/
    │   │   ├── provider.ts           # AI SDK Model Provider (Google / OpenAI)
    │   │   └── embeddings.ts         # Text embedding generator helper
    │   └── utils/
    │       ├── cn.ts                 # Tailwind merge & clsx utility
    │       ├── formatters.ts         # Number, date, slug helpers
    │       └── logger.ts             # Lightweight structured logger
    │
    └── services/                     # ⚙️ Application & Business Services Layer
        ├── comic.service.ts          # CRUD, filtering, hybrid search RPC calls
        ├── anilist.service.ts        # AniList GraphQL client with rate limiters
        ├── jikan.service.ts          # Jikan/MAL validation client
        └── recommendation.service.ts # RAG context assembly & prompt engineering
```

---

## 3. 🛡️ Senior Standards Checklist

### 3.1 Type-Safe Environment (`src/env.ts`)
Tidak boleh menggunakan `process.env.VARIABLE` secara liar tanpa runtime validation. Semua variable di-parse di satu tempat dengan Zod:

```typescript
// src/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(['google', 'openai']).default('google'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  MAL_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

---

### 3.2 Result Pattern / Explicit Error Handling
Hindari `throw new Error()` yang tidak tertangkap. Gunakan *Result Object Pattern* untuk service calls:

```typescript
// src/core/types/result.ts
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const Ok = <T>(data: T): Result<T, never> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });
```

---

### 3.3 Server & Client Boundary Hygiene (RSC Rules)
1. **Default: Server Components.** Semua fetch data awal terjadi di server via RSC (nol bundle JS dikirim ke browser).
2. **Leaf Interaction:** Gunakan directive `'use client'` hanya di daun pohon komponen terkecil (contoh: tombol bookmark, textarea chat input, theme toggle).
3. **No Waterfalls:** Gunakan `Promise.all()` atau React Suspense streaming saat fetching multiple independent sources.

---

### 3.4 Strict Database Typed Queries
Setiap interaksi dengan Supabase wajib menggunakan *Database Types* dari `src/core/types/database.ts`:

```typescript
// src/services/comic.service.ts
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/core/types/database';

export async function searchComicsHybrid(params: {
  queryEmbedding: number[];
  filterType?: 'MANGA' | 'MANHWA' | 'MANHUA';
  threshold?: number;
  limit?: number;
}) {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase.rpc('match_comics_hybrid', {
    query_embedding: params.queryEmbedding,
    match_threshold: params.threshold ?? 0.65,
    match_count: params.limit ?? 8,
    filter_type: params.filterType ?? null,
  });

  if (error) {
    console.error('[ComicService.searchComicsHybrid] RPC Error:', error);
    return [];
  }

  return data ?? [];
}
```

---

## 4. 🧪 UI/UX Polish & Minimalist Design Language

1. **Color Palette:** Deep Zinc / Obsidian Dark Theme (`bg-zinc-950`, `border-zinc-800`, `text-zinc-100`) dengan aksen Neon Violet / Cyan (`violet-500` / `cyan-400`).
2. **Typography:** Font modern sans-serif (Inter / Geist) dengan *fluid typography* dan *line-clamp* presisi pada sinopsis komik.
3. **Micro-Interactions:** Shimmer skeleton saat loading, smooth spring transition untuk chat bubble, dan hover card elevation.
4. **Zero Layout Shifts (CLS 0):** Selalu tentukan `aspect-ratio` pada cover komik (`aspect-[3/4]`) dan gunakan Next.js `<Image>` dengan blur placeholder.
