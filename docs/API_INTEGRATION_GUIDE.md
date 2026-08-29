# 🔌 Verified Comic Metadata API Integration Guide

Dokumentasi teknis integrasi API eksternal untuk **Akashic Dex**, telah diverifikasi langsung berdasarkan spesifikasi resmi:
- **MyAnimeList API v2 Spec:** [`myanimelist.net/apiconfig/references/api/v2`](https://myanimelist.net/apiconfig/references/api/v2)
- **Jikan REST API v4 Spec:** [`docs.api.jikan.moe`](https://docs.api.jikan.moe/)
- **Comick Reverse-Engineered Spec:** [`comick.dev`](https://comick.dev) / `api.comick.fun`
- **AniList GraphQL API:** [`anilist.gitbook.io/anilist-apiv2-docs`](https://anilist.gitbook.io/anilist-apiv2-docs/)

---

## 1. MyAnimeList (MAL) Official API v2

API resmi dari MyAnimeList berbasis REST JSON API v2.

### 🔑 Autentikasi & Header
MAL API v2 mendukung 2 metode otentikasi:
1. **`client_auth` (Public Data)**: Cukup menyertakan Client ID di header.
   ```http
   X-MAL-CLIENT-ID: <your_client_id>
   ```
2. **`main_auth` (User/OAuth2)**: Menggunakan Bearer token untuk aksi user list/profile.
   ```http
   Authorization: Bearer <access_token>
   ```

> **Untuk Akashic Dex Ingestion:** Cukup menggunakan `X-MAL-CLIENT-ID` karena kita hanya membaca metadata katalog publik.

---

### 📡 Endpoints Resmi MAL API v2

#### 1. `GET /v2/manga` (Search Manga/Manhwa)
* **Base URL:** `https://api.myanimelist.net/v2/manga`
* **Query Parameters:**
  * `q` *(string, required)*: Keyword pencarian (minimal 3 karakter).
  * `limit` *(integer, default: 100, max: 100)*: Jumlah hasil per page.
  * `offset` *(integer, default: 0)*: Offset data.
  * `fields` *(string)*: Daftar field tambahan dipisah koma (contoh: `id,title,main_picture,synopsis,mean,media_type,status,genres,num_chapters`).

#### 2. `GET /v2/manga/{manga_id}` (Detail Manga)
* **Base URL:** `https://api.myanimelist.net/v2/manga/{manga_id}`
* **Query Parameters:**
  * `fields` *(string)*: Field spesifik yang ingin di-expand.
* **Daftar Fields Resmi yang Didukung:**
  `id`, `title`, `main_picture`, `alternative_titles`, `start_date`, `end_date`, `synopsis`, `mean`, `rank`, `popularity`, `num_list_users`, `num_scoring_users`, `nsfw`, `created_at`, `updated_at`, `media_type`, `status`, `genres`, `num_volumes`, `num_chapters`, `authors{first_name,last_name}`, `pictures`, `background`, `related_anime`, `related_manga`, `recommendations`, `serialization{name}`.
* **Enum `media_type`:** `unknown`, `manga`, `novel`, `one_shot`, `doujinshi`, `manhwa`, `manhua`, `oel`.
* **Enum `status`:** `finished`, `currently_publishing`, `not_yet_published`.

#### 3. `GET /v2/manga/ranking` (Ranking & Popularity)
* **Base URL:** `https://api.myanimelist.net/v2/manga/ranking`
* **Query Parameters:**
  * `ranking_type` *(string, required)*: 
    * `all` (Semua komik)
    * `manga` (Top Manga)
    * `novels` (Top Light Novel)
    * `oneshots` (Top One-shot)
    * `doujin` (Top Doujinshi)
    * `manhwa` (Top Manhwa Korea)
    * `manhua` (Top Manhua China)
    * `bypopularity` (Paling Populer)
    * `favorite` (Paling Banyak di-Favorite)
  * `limit` *(integer, default: 100, max: 500)*
  * `offset` *(integer, default: 0)*
  * `fields` *(string)*

---

### 💻 Contoh Implementasi Client MAL API v2 (TypeScript)

```typescript
// lib/api/mal-client.ts

export interface MALMangaNode {
  id: number;
  title: string;
  main_picture?: {
    medium: string;
    large: string;
  };
  alternative_titles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  synopsis?: string;
  mean?: number; // Rating scale 1.00 - 10.00
  rank?: number;
  popularity?: number;
  media_type: 'manga' | 'manhwa' | 'manhua' | 'novel' | 'one_shot' | 'doujinshi' | 'oel';
  status: 'finished' | 'currently_publishing' | 'not_yet_published';
  num_chapters?: number;
  genres: Array<{ id: number; name: string }>;
  authors?: Array<{
    node: { id: number; first_name: string; last_name: string };
    role: string;
  }>;
}

const MAL_BASE_URL = 'https://api.myanimelist.net/v2';
const DEFAULT_FIELDS = [
  'id', 'title', 'main_picture', 'alternative_titles',
  'synopsis', 'mean', 'rank', 'popularity',
  'media_type', 'status', 'genres', 'num_chapters', 'authors{first_name,last_name}'
].join(',');

export async function fetchMALRanking(
  rankingType: 'manhwa' | 'manhua' | 'manga' | 'bypopularity' = 'manhwa',
  limit = 100,
  offset = 0
): Promise<MALMangaNode[]> {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) throw new Error('MAL_CLIENT_ID environment variable is missing');

  const url = `${MAL_BASE_URL}/manga/ranking?ranking_type=${rankingType}&limit=${limit}&offset=${offset}&fields=${DEFAULT_FIELDS}`;

  const res = await fetch(url, {
    headers: {
      'X-MAL-CLIENT-ID': clientId,
    },
    next: { revalidate: 3600 }, // Cache 1 hour
  });

  if (!res.ok) {
    throw new Error(`MAL API Error ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  return json.data.map((item: { node: MALMangaNode }) => item.node);
}
```

---

## 2. Jikan REST API v4 (Unofficial MAL Scraper API)

Jikan adalah API publik gratis berbasis PHP/Lumen yang men-scrape dan mem-parse MyAnimeList secara real-time.

### 🔑 Kebijakan Rate Limit
* **Auth:** Bebas tanpa API Key.
* **Rate Limit Resmi:**
  * **3 request per detik** (per IP).
  * **60 request per menit** (per IP).
  * Status code jika terlampaui: `429 Too Many Requests`.

---

### 📡 Endpoints Resmi Jikan API v4

#### 1. `GET /v4/manga` (Search & Advanced Query)
* **Base URL:** `https://api.jikan.moe/v4/manga`
* **Query Parameters Resmi:**
  * `page` *(integer, default: 1)*
  * `limit` *(integer, default: 25, max: 25)*
  * `q` *(string)*: Query pencarian
  * `type` *(enum)*: `manga`, `novel`, `lightnovel`, `oneshot`, `doujin`, `manhwa`, `manhua`
  * `score` *(number)*: Filter minimum score
  * `min_score` / `max_score` *(number)*
  * `status` *(enum)*: `publishing`, `complete`, `hiatus`, `discontinued`, `upcoming`
  * `sfw` *(boolean)*: Filter konten SFW
  * `genres` *(string)*: Filter ID genre (contoh: `1,2,4`)
  * `genres_exclude` *(string)*
  * `order_by` *(enum)*: `mal_id`, `title`, `start_date`, `end_date`, `chapters`, `volumes`, `score`, `scored_by`, `rank`, `popularity`, `members`, `favorites`
  * `sort` *(enum)*: `desc`, `asc`
  * `letter` *(string)*: Filter awalan huruf

#### 2. `GET /v4/manga/{id}/full` (Detail Lengkap)
* Mengembalikan seluruh relasi, genres, themes, demographics, authors, pictures, dan external links.

#### 3. `GET /v4/top/manga` (Top Ranking)
* **Query Parameters:** `type` (`manhwa` / `manhua` / `manga`), `filter` (`bypopularity` / `favorite` / `publishing`), `page`, `limit`.

---

### 💻 Contoh Implementasi Jikan Client dengan Auto-Retry Rate Limiter (TypeScript)

```typescript
// lib/api/jikan-client.ts

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      console.warn(`[Jikan] 429 Rate Limit Hit. Backoff ${(i + 1) * delayMs}ms...`);
      await sleep((i + 1) * delayMs);
      continue;
    }
    if (!res.ok) throw new Error(`[Jikan] HTTP Error ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  throw new Error(`[Jikan] Failed after ${retries} retries`);
}

export async function fetchTopManhwaJikan(page = 1) {
  const url = `${JIKAN_BASE_URL}/top/manga?type=manhwa&filter=bypopularity&page=${page}&limit=25`;
  const response = await fetchWithRetry(url);

  return response.data.map((item: any) => ({
    malId: item.mal_id,
    title: item.title,
    titleEnglish: item.title_english,
    titleJapanese: item.title_japanese,
    type: item.type, // 'Manhwa'
    status: item.status, // 'Publishing' | 'Finished'
    chapters: item.chapters,
    score: item.score,
    popularity: item.popularity,
    synopsis: item.synopsis,
    genres: item.genres.map((g: any) => g.name),
    themes: item.themes.map((t: any) => t.name), // e.g. 'Martial Arts', 'Reincarnation'
    demographics: item.demographics.map((d: any) => d.name),
    coverImage: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
  }));
}
```

---

## 3. Comick API (`https://comick.dev` / `api.comick.fun`)

Comick adalah salah satu indeks komik webtoon dan scanlation terbesar di dunia dengan database Manhwa Korea dan Manhua China paling kaya.

### ⚠️ Status & WAF Protection
* **Status:** Reverse-engineered / Internal REST API.
* **Cloudflare Protection:** Browser/Server request **wajib menyertakan Header `User-Agent` yang valid dan unik** (jangan gunakan default node-fetch / Axios tanpa User-Agent).
* **Base Domain Aktif:** `https://api.comick.fun` (atau `https://api.comick.io`).

---

### 📡 Endpoints Utama Comick

#### 1. `GET /v1.0/search` (Search & Filter)
* **URL:** `https://api.comick.fun/v1.0/search`
* **Query Parameters:**
  * `q` *(string)*: Kata kunci judul / karakter
  * `type` *(string)*: `comic`
  * `country` *(string)*: `kr` (Manhwa Korea), `jp` (Manga Jepang), `cn` (Manhua China)
  * `sort` *(string)*: `view` (Paling banyak dibaca), `rating`, `uploaded`, `follow`
  * `page` *(integer, default: 1)*
  * `limit` *(integer, default: 30, max: 50)*
  * `genres` / `excludes` *(string, slugs)*

#### 2. `GET /comic/{slug_or_hid}` (Detail Komik)
* **URL:** `https://api.comick.fun/comic/{slug_or_hid}`
* **Contoh:** `https://api.comick.fun/comic/solo-leveling`
* **Data yang Dikembalikan:**
  * `title`, `desc` (sinopsis lengkap), `status` (1: Ongoing, 2: Completed, 3: Cancelled, 4: Hiatus)
  * `country` (`kr`, `jp`, `cn`)
  * `bayesian_rating` (contoh: `"9.42"`)
  * `last_chapter` (total chapter terbaru)
  * `md_comic_md_genres` (Array tag/genre: Action, Murim, System, Isekai, Regression)
  * `md_covers` (Path key cover gambar, di-host di `https://meo.comick.pictures/{b2key}`)

---

### 💻 Contoh Implementasi Comick Client (TypeScript)

```typescript
// lib/api/comick-client.ts

export async function fetchComickBySlug(slug: string) {
  const url = `https://api.comick.fun/comic/${encodeURIComponent(slug)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AkashicDex/1.0 (Comic Semantic Engine; contact@akashic.dev)',
      'Accept': 'application/json',
    },
    next: { revalidate: 86400 }, // Cache 24 hours
  });

  if (!res.ok) {
    throw new Error(`Comick API Error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const c = data.comic;

  return {
    sourceId: c.id,
    hid: c.hid,
    slug: c.slug,
    title: c.title,
    synopsis: c.desc,
    type: c.country === 'kr' ? 'MANHWA' : c.country === 'cn' ? 'MANHUA' : 'MANGA',
    status: c.status === 2 ? 'FINISHED' : 'RELEASING',
    rating: parseFloat(c.bayesian_rating || '0'),
    lastChapter: c.last_chapter ? parseFloat(c.last_chapter) : null,
    genres: c.md_comic_md_genres?.map((g: any) => g.md_genres.name) || [],
    coverUrl: c.md_covers?.[0]?.b2key
      ? `https://meo.comick.pictures/${c.md_covers[0].b2key}`
      : null,
  };
}
```

---

## 4. AniList GraphQL API (⭐ Rekomendasi Utama Seeder)

AniList merupakan sumber data paling stabil dengan dukungan GraphQL, tidak memerlukan registrasi API key untuk query publik, dan memiliki **sistem Tag berbobot persentase (%)**.

### 📡 Query GraphQL Lengkap untuk Ingestion Seeder

```graphql
query IngestComics($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
      lastPage
    }
    media(type: MANGA, sort: [POPULARITY_DESC, SCORE_DESC]) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      countryOfOrigin # JP (Manga), KR (Manhwa), CN (Manhua)
      format # MANGA, ONE_SHOT
      status # RELEASING, FINISHED, NOT_YET_RELEASED, CANCELLED, HIATUS
      description(asHtml: false)
      chapters
      volumes
      averageScore # 0 - 100
      popularity
      genres # General genres (Action, Fantasy, Romance)
      tags {
        name # Specific tropes (e.g. "Cunning Protagonist", "Cultivation", "Reincarnation")
        rank # Relevance weight (0 - 100%)
        category # e.g. "Theme / Setting / Cast"
      }
      coverImage {
        extraLarge
        large
      }
      bannerImage
      siteUrl
    }
  }
}
```

---

## 5. Ringkasan Evaluasi & Rekomendasi Arsitektur

| Aspek | MAL API v2 | Jikan API v4 | Comick API | AniList API |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `X-MAL-CLIENT-ID` | None | None (Custom UA) | None |
| **Rate Limit** | Moderat | Ketat (3 req/s) | Moderat (WAF) | **Tinggi (90 req/min)** |
| **Kelengkapan Manhwa** | Cukup | Cukup | **Sangat Lengkap** | **Sangat Lengkap** |
| **Struktur Tropes/Embedding** | Rendah | Sedang (`themes`) | Tinggi (`genres`) | **S-Tier (Tags + Rank %)** |
| **Stabilitas Production** | Resmi & Stabil | Bergantung MAL | Rawan Migrasi Domain | **Resmi & Sangat Stabil** |

### 🎯 Blueprint Integrasi Resmi Akashic Dex (MVP):
1. **Primary Ingestion Engine (⭐ AniList GraphQL):**
   - Menarik seluruh data katalog (Manga, Manhwa, Manhua) hingga 10.000 judul terpopuler.
   - Mengambil data `idMal` bawaan yang sudah ada di AniList untuk linking otomatis ke MyAnimeList.
   - Mengambil **Tag & Tropes berbobot (%)** (misal: *Cunning Protagonist: 85%*, *Cultivation: 92%*) yang langsung di-convert jadi *Vector Embeddings* di Supabase `pgvector`.
2. **Score & Cross-Reference Engine (MAL API v2 / Jikan API v4):**
   - Validasi rating/skor resmi MyAnimeList (`mean`, `rank`, `num_scoring_users`).
   - Menyediakan tautan resmi ke MyAnimeList (`https://myanimelist.net/manga/{idMal}`).
3. **Comick Scraper (Backlog / Future Phase):**
   - Ditunda ke fase lanjutan untuk menjaga pipeline data MVP 100% stabil tanpa risiko terkena Cloudflare IP block.
