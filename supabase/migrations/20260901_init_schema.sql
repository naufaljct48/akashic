-- ==============================================================================
-- Akashic Dex — Supabase Initial Schema & Vector Hybrid Search Setup
-- ==============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Enums
DO $$ BEGIN
    CREATE TYPE comic_type AS ENUM ('MANGA', 'MANHWA', 'MANHUA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE comic_status AS ENUM ('RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE comic_format AS ENUM ('MANGA', 'ONE_SHOT', 'NOVEL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Comics Table
CREATE TABLE IF NOT EXISTS public.comics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INT UNIQUE NOT NULL, -- AniList ID
    id_mal INT, -- MyAnimeList ID
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
    tags TEXT[] DEFAULT '{}', -- Narrative tropes & weighted keywords
    total_chapters INT,
    release_year INT,
    average_score INT, -- 0 - 100
    popularity INT,
    cover_image_url TEXT,
    banner_image_url TEXT,
    country_of_origin VARCHAR(2) DEFAULT 'JP', -- JP, KR, CN
    site_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Vector Embeddings Table
CREATE TABLE IF NOT EXISTS public.comic_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE UNIQUE NOT NULL,
    content_text TEXT NOT NULL, -- Formatted string: Title + Type + Genres + Tags + Synopsis
    embedding vector(1536) NOT NULL, -- 1536-dim vector for embeddings
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_comic_embeddings_hnsw 
ON public.comic_embeddings 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_comics_genres ON public.comics USING GIN (genres);
CREATE INDEX IF NOT EXISTS idx_comics_tags ON public.comics USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_comics_type ON public.comics (type);
CREATE INDEX IF NOT EXISTS idx_comics_status ON public.comics (status);
CREATE INDEX IF NOT EXISTS idx_comics_popularity ON public.comics (popularity DESC);
CREATE INDEX IF NOT EXISTS idx_comics_average_score ON public.comics (average_score DESC);

-- 6. User Bookmarks Table
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'READING', -- 'FAVORITE', 'READING', 'PLAN_TO_READ', 'COMPLETED'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, comic_id)
);

-- 7. Chat History Sessions Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_ip TEXT,
    title TEXT DEFAULT 'New Conversation',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Daily Rate Limiter Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- User UUID or Guest IP hash
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    prompt_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (identifier, request_date)
);

-- 9. Hybrid Search Stored Procedure (RPC)
CREATE OR REPLACE FUNCTION match_comics_hybrid(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.35,
    match_count int DEFAULT 8,
    filter_type comic_type DEFAULT NULL,
    filter_status comic_status DEFAULT NULL,
    filter_genres text[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    source_id INT,
    id_mal INT,
    slug TEXT,
    title_romaji TEXT,
    title_english TEXT,
    type comic_type,
    status comic_status,
    genres TEXT[],
    tags TEXT[],
    synopsis TEXT,
    cover_image_url TEXT,
    banner_image_url TEXT,
    average_score INT,
    total_chapters INT,
    release_year INT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.source_id,
        c.id_mal,
        c.slug,
        c.title_romaji,
        c.title_english,
        c.type,
        c.status,
        c.genres,
        c.tags,
        c.synopsis,
        c.cover_image_url,
        c.banner_image_url,
        c.average_score,
        c.total_chapters,
        c.release_year,
        (1 - (ce.embedding <=> query_embedding))::float AS similarity
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

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 11. Security Policies
-- Public Read for comics & embeddings
DROP POLICY IF EXISTS "Allow public read access on comics" ON public.comics;
CREATE POLICY "Allow public read access on comics" ON public.comics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on comic_embeddings" ON public.comic_embeddings;
CREATE POLICY "Allow public read access on comic_embeddings" ON public.comic_embeddings FOR SELECT USING (true);

-- User bookmarks: only owner can manage
DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users manage own bookmarks" ON public.user_bookmarks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat sessions: authenticated users manage own, public can insert guest sessions
DROP POLICY IF EXISTS "Users manage own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users manage own chat sessions" ON public.chat_sessions
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Rate limits: public can read/write own rate limit record
DROP POLICY IF EXISTS "Allow rate limit tracking" ON public.rate_limits;
CREATE POLICY "Allow rate limit tracking" ON public.rate_limits FOR ALL USING (true);
