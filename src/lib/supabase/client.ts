/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client.
 * Uses NEXT_PUBLIC_ env vars which are safe to expose (protected by RLS).
 *
 * SECURITY: Do NOT import SUPABASE_SERVICE_ROLE_KEY here.
 *           This file is imported by client components.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Returns a Supabase client configured for browser usage.
 * Safe to call from client components and hooks.
 *
 * Uses the anon key — all access is governed by Row Level Security policies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
