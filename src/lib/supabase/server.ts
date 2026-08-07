// src/lib/supabase/server.ts
//
// Server-side Supabase client for App Router API routes and Server Actions.
//
// Only uses NEXT_PUBLIC_SUPABASE_ANON_KEY. Does not use service role.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Returns a server-side Supabase client using the anon key.
 * Used for safe server-side queries under RLS.
 */
export function createServerAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      '[supabase/server] Supabase URL or Anon Key is missing. Check your environment variables.'
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}


