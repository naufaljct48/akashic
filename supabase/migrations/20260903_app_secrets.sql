-- ==============================================================================
-- Akashic Dex — app_secrets table + get_app_secret()
--
-- These already exist in the deployed database (the ai-curator Edge Function
-- falls back to `get_app_secret` when Deno.env has no AI_API_KEY), but they were
-- never captured as a migration, so a fresh clone of this repo could not stand
-- the project up. This file reconstructs them from that contract.
--
-- Written to be idempotent and safe to re-run. If your live definition differs,
-- dump it and replace this file — the live database is the source of truth here,
-- not this reconstruction.
-- ==============================================================================

-- 1. Secret store. Never readable by anon/authenticated: the AI provider key
--    lives here, and the whole point of the Edge Function is that the key never
--    reaches the browser.
CREATE TABLE IF NOT EXISTS public.app_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_secrets TO service_role;

-- 2. Single-key accessor. SECURITY DEFINER so the Edge Function can read a
--    secret without the table itself being reachable.
CREATE OR REPLACE FUNCTION public.get_app_secret(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT value INTO v_value FROM public.app_secrets WHERE key = p_key;
    RETURN v_value;
END;
$$;

-- Execute is service_role only. Without this REVOKE, anyone holding the public
-- anon key could POST /rest/v1/rpc/get_app_secret and read the AI provider key
-- straight out of the database.
REVOKE ALL ON FUNCTION public.get_app_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_secret(TEXT) TO service_role;

-- 3. match_comics_hybrid is currently executable by anon. It leaks no data the
--    public catalog SELECT does not already expose, but nothing generates or
--    queries embeddings today, so it is an unused endpoint that anyone can make
--    the database do vector work on. Close it until embedding search is real.
REVOKE ALL ON FUNCTION public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[])
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_comics_hybrid(vector, float, int, comic_type, comic_status, text[])
    TO service_role;
