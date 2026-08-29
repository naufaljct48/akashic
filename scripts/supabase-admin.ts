import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/core/types/database';

/**
 * The project URL is the same value under three names. `NEXT_PUBLIC_` is a
 * leftover from a Next.js scaffold and reads as a client-side variable, which is
 * a good way to end up with an unset CI secret; `SUPABASE_URL` is the name to
 * prefer. `VITE_SUPABASE_URL` lets a local `.env` drive the scripts unchanged.
 *
 * The service role key has no alias on purpose — it is the one true secret here,
 * it must never be prefixed with VITE_ or NEXT_PUBLIC_, and it must never be
 * committed. Set it as a repository secret, not in a file.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)',
    !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  throw new Error(
    `Missing ${missing.join(' and ')}. Ingestion writes require the service role key.\n` +
      'Locally: copy .env.example to .env and fill them in.\n' +
      'In CI: add them as GitHub repository secrets under Settings > Secrets and variables > Actions.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);
