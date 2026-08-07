import { NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase';

export const revalidate = 0; // Never cache the health check

export async function GET() {
  try {
    const supabase = createServerAnonClient();
    const nowIso = new Date().toISOString();

    const { count, error } = await supabase
      .from('hackathons')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('registration_end', nowIso);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      activeHackathons: count || 0
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (error) {
    console.error('[API/health] Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Failed to connect to database'
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  }
}
