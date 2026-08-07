import { unstable_cache } from 'next/cache';
import { createServerAnonClient } from '@/lib/supabase';
import type { Hackathon, HackathonFilters } from '@/types/hackathon';

export interface HackathonsResponse {
  hackathons: Hackathon[];
  total: number;
  page: number;
  totalPages: number;
}

export interface HackathonStats {
  total: number;
  online: number;
  offline: number;
  sources: Record<string, number>;
}

/**
 * Fetch filtered, paginated hackathons from Supabase (server-side).
 * Ideal for Server Components and generateStaticParams.
 */
export async function getHackathons(filters: HackathonFilters = {}): Promise<HackathonsResponse> {
  const mode = filters.mode;
  const source = filters.source_site;
  const search = filters.search;
  const sort = filters.sort || 'deadline_asc';
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(48, Math.max(1, filters.limit || 24));

  const supabase = createServerAnonClient();
  
  let query = supabase
    .from('hackathons')
    .select('*', { count: 'exact' });

  // Standard filters for active and open hackathons
  const nowIso = new Date().toISOString();
  query = query.eq('is_active', true).gt('registration_end', nowIso);

  if (mode) {
    query = query.eq('mode', mode);
  }
  if (source) {
    query = query.eq('source_site', source);
  }
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  // Sorting
  if (sort === 'deadline_asc') {
    query = query.order('registration_end', { ascending: true });
  } else if (sort === 'deadline_desc') {
    query = query.order('registration_end', { ascending: false });
  } else if (sort === 'newest') {
    query = query.order('scraped_at', { ascending: false });
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('[getHackathons] Supabase error:', error.message);
    throw new Error(`Failed to retrieve hackathons: ${error.message}`);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    hackathons: (data as Hackathon[]) || [],
    total,
    page,
    totalPages,
  };
}

/**
 * Fetch a single hackathon detail by ID (UUID) or by resolving a slug string.
 */
export async function getHackathonBySlug(slug: string): Promise<Hackathon | null> {
  const supabase = createServerAnonClient();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let query = supabase.from('hackathons').select('*');

  if (uuidRegex.test(slug)) {
    // If it's a valid UUID, fetch by ID
    query = query.eq('id', slug);
  } else {
    // Fallback: match by title converting slug hyphens back to spaces or looking for URL match
    const titleGuess = slug.replace(/-/g, ' ');
    query = query.or(`title.ilike.%${titleGuess}%,source_url.ilike.%${slug}%`);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error('[getHackathonBySlug] Supabase error:', error.message);
    return null;
  }

  return (data as Hackathon) || null;
}

/**
 * Fetch and calculate aggregation statistics for all active hackathons.
 * Caches results with Next.js unstable_cache for 1 hour to optimize performance.
 */
export const getHackathonStats = unstable_cache(
  async (): Promise<HackathonStats> => {
    const supabase = createServerAnonClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('hackathons')
      .select('mode, source_site')
      .eq('is_active', true)
      .gt('registration_end', nowIso);

    if (error) {
      console.error('[getHackathonStats] Supabase error:', error.message);
      throw new Error(`Failed to retrieve statistics: ${error.message}`);
    }

    const stats: HackathonStats = {
      total: data?.length || 0,
      online: 0,
      offline: 0,
      sources: {},
    };

    if (data) {
      for (const item of data) {
        // Mode counters
        if (item.mode === 'online') {
          stats.online++;
        } else if (item.mode === 'offline' || item.mode === 'hybrid') {
          // Both count as physical/offline presence
          stats.offline++;
        }

        // Source counters
        const src = item.source_site;
        stats.sources[src] = (stats.sources[src] || 0) + 1;
      }
    }

    return stats;
  },
  ['hackathon-stats'],
  { revalidate: 60, tags: ['stats'] }
);
