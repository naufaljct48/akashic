-- Retarget the embedding column at bge-m3.
--
-- The column was written for a 1536-dimension model. The one actually chosen is
-- @cf/baai/bge-m3, which emits 1024 dense dimensions, is trained on 100+
-- languages, and needs no instruction prefix on either side -- documents and
-- queries embed identically. It bills at 1,075 Neurons per million input tokens
-- against a 10,000/day free allocation, so the whole catalog costs nothing.
--
-- Nothing is lost here: no row has ever been written to comic_embeddings.

DROP INDEX IF EXISTS public.idx_comic_embeddings_hnsw;

-- Empty today, but an ALTER of a vector's dimension cannot rewrite existing
-- rows. Truncating states the requirement instead of failing on it later.
TRUNCATE TABLE public.comic_embeddings;

ALTER TABLE public.comic_embeddings
    ALTER COLUMN embedding TYPE vector(1024);

CREATE INDEX IF NOT EXISTS idx_comic_embeddings_hnsw
ON public.comic_embeddings
USING hnsw (embedding vector_cosine_ops);

-- The RPC declares the query vector's dimension too, so it has to move with the
-- column or every call fails on a dimension mismatch.
--
-- match_threshold also changes, 0.35 -> 0.45, and that is not cosmetic. bge-m3
-- packs its cosine scores into a narrow band: measured against real catalog
-- text, correct answers land near 0.51-0.60 while clearly wrong ones still
-- score 0.37-0.47. A 0.35 floor admits the entire catalog and turns the
-- threshold into decoration. 0.45 cuts the obvious misses while leaving the
-- ordering to do the real work.
--
-- The argument types are unchanged (Postgres records `vector`, not its
-- dimension, in the signature), so this replaces the existing function in place
-- and the grants below still describe the same object.
CREATE OR REPLACE FUNCTION match_comics_hybrid(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.45,
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

-- Restated from 20260903 so a replaced function can never silently widen access.
-- The query side runs in the ai-curator Edge Function, which is where the
-- provider key already lives; the browser must not reach this.
REVOKE ALL ON FUNCTION public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[])
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[])
    TO service_role;
