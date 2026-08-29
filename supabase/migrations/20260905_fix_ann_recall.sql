-- Fix the retrieval defect, then give ranking a notability signal.
--
-- MEASURED BEFORE: recall@20 was 8/21 on a fixture of description-shaped
-- queries whose answers are all in the catalog (scripts/eval-recall.ts).
--
-- THE DEFECT: pgvector's HNSW index never returns more rows than
-- `hnsw.ef_search`, which defaults to 40. Asking match_comics_hybrid for 50
-- matches returned exactly 40 -- silently -- and those 40 were a poor
-- approximation of the true nearest neighbours.
--
-- The proof: for "a bald hero who defeats every enemy with a single punch",
-- One Punch Man's true cosine similarity is 0.5814 and only ONE of the 40
-- returned rows scored above it. It belongs at rank 2. The index never
-- surfaced it at all. Its stored text reads "a hero who manages to win all
-- battles with only one punch" -- so this was never a language, content, or
-- ranking problem. Every earlier theory was chasing a symptom of this.
--
-- ef_search must comfortably exceed the number of rows actually wanted, so it
-- is set per-function rather than left to the session default, where nothing
-- would ever set it.

DROP FUNCTION IF EXISTS public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[]);
DROP FUNCTION IF EXISTS public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[], float);

CREATE FUNCTION match_comics_hybrid(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.45,
    match_count int DEFAULT 8,
    filter_type comic_type DEFAULT NULL,
    filter_status comic_status DEFAULT NULL,
    filter_genres text[] DEFAULT NULL,
    popularity_weight float DEFAULT 0.15
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
    PERFORM set_config('hnsw.ef_search', '400', true);

    RETURN QUERY
    -- Two stages on purpose. The HNSW index only accelerates a plain
    -- `ORDER BY embedding <=> query`; ordering by a blended expression would
    -- discard the index and scan every row. So the index picks a generous
    -- shortlist, and the blend re-ranks only that.
    WITH shortlist AS (
        SELECT
            ce.comic_id,
            (1 - (ce.embedding <=> query_embedding))::float AS sim
        FROM public.comic_embeddings ce
        JOIN public.comics cc ON cc.id = ce.comic_id
        WHERE
            (filter_type IS NULL OR cc.type = filter_type)
            AND (filter_status IS NULL OR cc.status = filter_status)
            AND (filter_genres IS NULL OR cc.genres @> filter_genres)
        ORDER BY ce.embedding <=> query_embedding
        LIMIT LEAST(GREATEST(match_count * 10, 200), 400)
    )
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
        s.sim AS similarity
    FROM shortlist s
    JOIN public.comics c ON c.id = s.comic_id
    WHERE s.sim > match_threshold
    -- Cosine alone loses to lexical accidents across 18,000 rows: the query
    -- "raksasa yang memakan manusia di balik tembok" ranked Attack on Titan
    -- (popularity 226,245) below Eat-Man (1,638) and EAT (1,897), whose only
    -- link to it is the word "eat" in the title.
    --
    -- log10(1+pop)/6 maps popularity 0..500,000 into roughly 0..1 and
    -- compresses the top, so fame tilts ties without overruling meaning. At
    -- weight 0.15 that query's answer moved from 12th to 1st.
    ORDER BY
        s.sim * (1 - popularity_weight)
        + popularity_weight * (log(1 + GREATEST(COALESCE(c.popularity, 0), 0)) / 6.0)
        DESC
    LIMIT match_count;
END;
$$;

-- Restated because the function was dropped and recreated: a new object starts
-- with default privileges, so without this anon would silently regain execute.
-- The query side belongs in the ai-curator Edge Function, where the provider
-- key already lives.
REVOKE ALL ON FUNCTION public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[], float)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[], float)
    TO service_role;
