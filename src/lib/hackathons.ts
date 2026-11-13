import { unstable_cache } from 'next/cache';
import { createServerAnonClient } from '@/lib/supabase';
import type { Hackathon, HackathonFilters, SourceSite } from '@/types/hackathon';

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

const SOURCES: SourceSite[] = ['unstop', 'devpost', 'hackculture'];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const MAX_PAGE = 100_000;

function normalizedSources(source: HackathonFilters['source_site']): SourceSite[] {
  if (!source) return [];
  return [...new Set(Array.isArray(source) ? source : [source])].filter((item) =>
    SOURCES.includes(item),
  );
}

function applyFilters(
  query: ReturnType<ReturnType<typeof createServerAnonClient>['from']>,
  _unused?: never,
) {
  return query;
}

export async function getHackathons(filters: HackathonFilters = {}): Promise<HackathonsResponse> {
  const mode = filters.mode;
  const sources = normalizedSources(filters.source_site);
  const search = filters.search?.trim().slice(0, 100);
  const sort = filters.sort || 'deadline_asc';
  const pageValue = Number.isFinite(filters.page) ? Math.floor(filters.page as number) : 1;
  const page = Math.min(MAX_PAGE, Math.max(1, pageValue));
  const limitValue = Number.isFinite(filters.limit) ? Math.floor(filters.limit as number) : DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitValue));

  const supabase = createServerAnonClient();
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('hackathons')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .gt('registration_end', nowIso);

  if (mode) query = query.eq('mode', mode);
  if (sources.length === 1) query = query.eq('source_site', sources[0]);
  else if (sources.length > 1) query = query.in('source_site', sources);

  if (search) query = query.ilike('title', `%${search.replace(/[\\%_]/g, '\\$&')}%`);

  if (sort === 'deadline_desc') {
    query = query.order('registration_end', { ascending: false });
  } else if (sort === 'newest') {
    query = query.order('scraped_at', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('registration_end', { ascending: true });
  }

  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1);
  if (error) {
    console.error('[getHackathons] Supabase error:', error.message);
    throw new Error('Failed to retrieve hackathons');
  }

  const total = count ?? 0;
  return {
    hackathons: (data ?? []) as Hackathon[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getHackathonBySlug(slug: string): Promise<Hackathon | null> {
  const supabase = createServerAnonClient();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(slug) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return null;

  let query = supabase.from('hackathons').select('*');
  if (uuidRegex.test(slug)) {
    query = query.eq('id', slug);
  } else {
    const titleGuess = slug.replace(/-/g, ' ');
    query = query.or(`title.ilike.${titleGuess},source_url.ilike.%${slug}%`);
  }

  const { data, error } = await query
    .eq('is_active', true)
    .gt('registration_end', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getHackathonBySlug] Supabase error:', error.message);
    return null;
  }
  return (data as Hackathon | null) ?? null;
}

/**
 * Aggregated counters use exact HEAD counts rather than downloading every
 * active row into the server process.
 */
export const getHackathonStats = unstable_cache(
  async (): Promise<HackathonStats> => {
    const supabase = createServerAnonClient();
    const nowIso = new Date().toISOString();
    const countFor = async (options?: { mode?: string; source?: SourceSite }) => {
      let query = supabase
        .from('hackathons')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('registration_end', nowIso);
      if (options?.mode) query = query.eq('mode', options.mode);
      if (options?.source) query = query.eq('source_site', options.source);
      return query;
    };

    const [totalResult, onlineResult, offlineResult, hybridResult, ...sourceResults] = await Promise.all([
      countFor(),
      countFor({ mode: 'online' }),
      countFor({ mode: 'offline' }),
      countFor({ mode: 'hybrid' }),
      ...SOURCES.map((source) => countFor({ source })),
    ]);

    const results = [totalResult, onlineResult, offlineResult, hybridResult, ...sourceResults];
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      console.error('[getHackathonStats] Supabase error:', failed.error.message);
      throw new Error('Failed to retrieve hackathon statistics');
    }

    const sources = Object.fromEntries(
      SOURCES.map((source, index) => [source, sourceResults[index].count ?? 0]),
    );
    return {
      total: totalResult.count ?? 0,
      online: onlineResult.count ?? 0,
      offline: (offlineResult.count ?? 0) + (hybridResult.count ?? 0),
      sources,
    };
  },
  ['hackathon-stats-v2'],
  { revalidate: 60, tags: ['stats'] },
);
