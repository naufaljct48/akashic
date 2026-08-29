import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/core/types/database';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
