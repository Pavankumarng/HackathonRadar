import { NextRequest, NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase';
import type { HackathonMode, SourceSite } from '@/types/hackathon';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize rate limiter (60 requests per 1 minute)
// Safely falls back if Upstash keys are missing (e.g., local dev)
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
  });
}

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limiting Check
    if (ratelimit) {
      // Use IP address as the identifier, fallback to 'anonymous'
      const ip = request.headers.get('x-forwarded-for') || 'anonymous';
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);
      
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString()
            }
          }
        );
      }
    }

    const { searchParams } = new URL(request.url);

    // Parse parameters
    const mode = searchParams.get('mode') as HackathonMode | null;
    const source = searchParams.get('source') as SourceSite | null;
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'deadline_asc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(48, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)));

    const supabase = createServerAnonClient();
    
    // Base query for active, open hackathons (RLS will filter is_active=true & registration_end > NOW())
    let query = supabase
      .from('hackathons')
      .select('*', { count: 'exact' });

    // Apply is_active and registration_end explicit filters just in case RLS logic is bypassed/not set
    const nowIso = new Date().toISOString();
    query = query.eq('is_active', true).gt('registration_end', nowIso);

    // Apply additional filters
    if (mode) {
      query = query.eq('mode', mode);
    }
    if (source) {
      query = query.eq('source_site', source);
    }
    if (search) {
      // Case-insensitive search on title
      query = query.ilike('title', `%${search}%`);
    }

    // Apply sorting
    if (sort === 'deadline_asc') {
      query = query.order('registration_end', { ascending: true });
    } else if (sort === 'deadline_desc') {
      query = query.order('registration_end', { ascending: false });
    } else if (sort === 'newest') {
      query = query.order('scraped_at', { ascending: false });
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Execute query
    const { data: hackathons, count, error } = await query;

    if (error) {
      console.error('[API/hackathons] Database error:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch hackathons from database.' },
        { status: 500 }
      );
    }

    // Dynamic stats aggregation (excluding range limit)
    let statsQuery = supabase
      .from('hackathons')
      .select('mode')
      .eq('is_active', true)
      .gt('registration_end', nowIso);

    if (mode) statsQuery = statsQuery.eq('mode', mode);
    if (source) statsQuery = statsQuery.eq('source_site', source);
    if (search) statsQuery = statsQuery.ilike('title', `%${search}%`);

    const { data: statsData } = await statsQuery;
    const stats = { total: 0, online: 0, offline: 0 };
    if (statsData) {
      stats.total = statsData.length;
      statsData.forEach((item) => {
        if (item.mode === 'online') {
          stats.online++;
        } else if (item.mode === 'offline' || item.mode === 'hybrid') {
          stats.offline++;
        }
      });
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const response = NextResponse.json({
      hackathons: hackathons || [],
      total,
      page,
      totalPages,
      stats,
    });

    // Set cache headers: 1 min cache (s-maxage=60), serve stale up to 1 min
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=60'
    );

    return response;
  } catch (err) {
    console.error('[API/hackathons] Internal server error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal server error occurred.' },
      { status: 500 }
    );
  }
}
