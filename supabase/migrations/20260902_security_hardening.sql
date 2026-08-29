-- ==============================================================================
-- Akashic Dex — Security Hardening
-- Locks anon down to read-only on catalog data, and moves rate limiting
-- server-side (the client-side localStorage counter is trivially bypassed).
-- ==============================================================================

-- 1. Atomic daily rate limit counter. Called by the ai-curator Edge Function
--    with the service_role key. SECURITY DEFINER so anon never needs table access.
CREATE OR REPLACE FUNCTION public.bump_rate_limit(p_identifier TEXT, p_max INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    INSERT INTO public.rate_limits (identifier, request_date, prompt_count)
    VALUES (p_identifier, CURRENT_DATE, 1)
    ON CONFLICT (identifier, request_date)
    DO UPDATE SET prompt_count = public.rate_limits.prompt_count + 1
    RETURNING prompt_count INTO v_count;

    RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_rate_limit(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(TEXT, INT) TO service_role;

-- 2. rate_limits was world-readable AND world-writable ("USING (true)" FOR ALL),
--    so anyone could reset or forge their own quota. Service role only now.
DROP POLICY IF EXISTS "Allow rate limit tracking" ON public.rate_limits;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- 3. chat_sessions allowed "user_id IS NULL", which let any anonymous visitor
--    read, edit and delete every guest conversation. Table is unused by the app.
DROP POLICY IF EXISTS "Users manage own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users manage own chat sessions" ON public.chat_sessions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.chat_sessions FROM anon;

-- 4. Catalog tables: public read stays, public writes go away. Grants are
--    revoked at role level so this holds no matter what policies exist upstream.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.comics FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.comic_embeddings FROM anon, authenticated;
GRANT SELECT ON public.comics TO anon, authenticated;
GRANT SELECT ON public.comic_embeddings TO anon, authenticated;

-- 5. Bookmarks are per-user; anon has no business there (the app stores them
--    in localStorage today, so nothing depends on anon access).
REVOKE ALL ON public.user_bookmarks FROM anon;
