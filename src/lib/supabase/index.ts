/**
 * src/lib/supabase/index.ts
 *
 * Barrel export for Supabase clients.
 *
 * SECURITY:
 *   - createClient()       → browser-safe (uses anon key + RLS)
 *   - createAdminClient()  → SERVER ONLY (uses service role key — bypasses RLS)
 *
 * Do NOT re-export createAdminClient from a client component barrel.
 */

// Browser client (safe for 'use client' files and React Server Components that don't need admin)
export { createClient } from './client';

// Server-only client exports
export { createServerAnonClient } from './server';
