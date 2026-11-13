import { NextRequest, NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase';
import type { HackathonMode, SourceSite } from '@/types/hackathon';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ALLOWED_MODES: HackathonMode[] = ['online', 'offline', 'hybrid'];
const ALLOWED_SOURCES: SourceSite[] = ['unstop', 'devpost', 'hackculture'];
const ALLOWED_SORTS = ['deadline_asc', 'deadline_desc', 'newest'] as const;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const MAX_PAGE = 100_000;
const MAX_SEARCH_LENGTH = 100;

let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'hackradar:api:hkts',
  });
}

function parsePositiveInteger(raw: string | null, fallback: number, maximum: number): number | null {
  if (raw === null || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) return null;
  return value;
}

function parseSources(params: URLSearchParams): SourceSite[] | null {
  const raw = params.getAll('source').flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
  const unique = [...new Set(raw)];
  if (unique.some((source) => !ALLOWED_SOURCES.includes(source as SourceSite))) return null;
  return unique as SourceSite[];
}

function searchPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

export async function GET(request: NextRequest) {
  try {
    if (ratelimit) {
      const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const ip = request.headers.get('x-real-ip')?.trim() || forwarded || 'anonymous';
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(reset),
            },
          },
        );
      }
    }

    const params = new URL(request.url).searchParams;
    const rawMode = params.get('mode');
    const mode = rawMode && rawMode !== 'all' ? rawMode : null;
    if (mode && !ALLOWED_MODES.includes(mode as HackathonMode)) {
      return NextResponse.json({ error: 'Invalid mode filter.' }, { status: 400 });
    }

    const sources = parseSources(params);
    if (sources === null) {
      return NextResponse.json({ error: 'Invalid source filter.' }, { status: 400 });
    }

    const rawSort = params.get('sort') || 'deadline_asc';
    if (!(ALLOWED_SORTS as readonly string[]).includes(rawSort)) {
      return NextResponse.json({ error: 'Invalid sort order.' }, { status: 400 });
    }

    const page = parsePositiveInteger(params.get('page'), 1, MAX_PAGE);
    const limit = parsePositiveInteger(params.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
    if (page === null || limit === null) {
      return NextResponse.json({ error: 'Page and limit must be valid positive integers.' }, { status: 400 });
    }

    const rawSearch = params.get('search')?.trim() || '';
    if (rawSearch.length > MAX_SEARCH_LENGTH) {
      return NextResponse.json({ error: `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.` }, { status: 400 });
    }
    const search = rawSearch || null;
    const supabase = createServerAnonClient();
    const nowIso = new Date().toISOString();

    let query = supabase
      .from('hackathons')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .gt('registration_end', nowIso);

    if (mode) query = query.eq('mode', mode as HackathonMode);
    if (sources.length === 1) query = query.eq('source_site', sources[0]);
    else if (sources.length > 1) query = query.in('source_site', sources);
    if (search) query = query.ilike('title', searchPattern(search));

    if (rawSort === 'deadline_desc') {
      query = query.order('registration_end', { ascending: false });
    } else if (rawSort === 'newest') {
      query = query.order('scraped_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('registration_end', { ascending: true });
    }

    const from = (page - 1) * limit;
    const { data: hackathons, count, error } = await query.range(from, from + limit - 1);
    if (error) {
      console.error('[API/hackathons] Database query failed:', error.message);
      return NextResponse.json({ error: 'Failed to fetch hackathons.' }, { status: 500 });
    }

    const countForMode = async (targetMode?: HackathonMode) => {
      let countQuery = supabase
        .from('hackathons')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('registration_end', nowIso);

      if (mode) countQuery = countQuery.eq('mode', mode as HackathonMode);
      if (targetMode) countQuery = countQuery.eq('mode', targetMode);
      if (sources.length === 1) countQuery = countQuery.eq('source_site', sources[0]);
      else if (sources.length > 1) countQuery = countQuery.in('source_site', sources);
      if (search) countQuery = countQuery.ilike('title', searchPattern(search));
      return countQuery;
    };

    const [onlineResult, offlineResult, hybridResult] = await Promise.all([
      countForMode('online'),
      countForMode('offline'),
      countForMode('hybrid'),
    ]);
    const statsError = [onlineResult.error, offlineResult.error, hybridResult.error].find(Boolean);
    if (statsError) {
      console.error('[API/hackathons] Stats query failed:', statsError.message);
      return NextResponse.json({ error: 'Failed to calculate hackathon statistics.' }, { status: 500 });
    }

    const total = count ?? 0;
    const response = NextResponse.json({
      hackathons: hackathons ?? [],
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total,
        online: onlineResult.count ?? 0,
        offline: (offlineResult.count ?? 0) + (hybridResult.count ?? 0),
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('[API/hackathons] Internal server error:', error);
    return NextResponse.json(
      { error: 'An unexpected internal server error occurred.' },
      { status: 500 },
    );
  }
}
