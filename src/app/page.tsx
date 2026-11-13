import { getHackathons, getHackathonStats, type HackathonsResponse } from '@/lib/hackathons';
import { createServerAnonClient } from '@/lib/supabase';
import type { HackathonMode, SourceSite, HackathonFilters } from '@/types/hackathon';
import HackathonDashboard from '@/components/HackathonDashboard';

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{
    mode?: string;
    source?: string;
    search?: string;
    sort?: string;
    page?: string;
    limit?: string;
  }>;
}

const SOURCES: SourceSite[] = ['unstop', 'devpost', 'hackculture'];
const MODES: HackathonMode[] = ['online', 'offline', 'hybrid'];
const SORTS: NonNullable<HackathonFilters['sort']>[] = [
  'deadline_asc',
  'deadline_desc',
  'newest',
];

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100_000) : fallback;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

  const mode = MODES.includes(params.mode as HackathonMode)
    ? params.mode as HackathonMode
    : undefined;

  const rawSources = (params.source || '')
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);
  const sourceValues = [...new Set(rawSources)].filter(
    (source): source is SourceSite => SOURCES.includes(source as SourceSite),
  );
  const source_site = sourceValues.length > 1
    ? sourceValues
    : sourceValues[0];

  const search = params.search?.trim().slice(0, 100) || undefined;
  const sort = SORTS.includes(params.sort as NonNullable<HackathonFilters['sort']>)
    ? params.sort as NonNullable<HackathonFilters['sort']>
    : 'deadline_asc';
  const page = positiveInteger(params.page, 1);
  const limit = Math.min(48, positiveInteger(params.limit, 24));

  const filters: HackathonFilters = { mode, source_site, search, sort, page, limit };
  let initialResponse: HackathonsResponse = {
    hackathons: [],
    total: 0,
    page: 1,
    totalPages: 0,
  };

  try {
    initialResponse = await getHackathons(filters);
  } catch (error) {
    console.error('[Home] Failed to load initial hackathons:', error);
  }

  let initialStats = { total: 0, online: 0, offline: 0 };
  try {
    const stats = await getHackathonStats();
    initialStats = {
      total: stats.total,
      online: stats.online,
      offline: stats.offline,
    };
  } catch (error) {
    console.error('[Home] Failed to load global statistics:', error);
  }

  let lastUpdatedText = 'Last updated: Unknown';
  try {
    const supabase = createServerAnonClient();
    const { data: latestRow, error } = await supabase
      .from('hackathons')
      .select('scraped_at')
      .not('scraped_at', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (latestRow?.scraped_at) {
      // Display the stored UTC timestamp directly; server rendering stays pure.
      lastUpdatedText = `Last scraped (UTC): ${latestRow.scraped_at.slice(0, 19).replace('T', ' ')}`;
    }
  } catch (error) {
    console.error('[Home] Failed to resolve latest scrape time:', error);
  }

  return (
    <HackathonDashboard
      initialHackathons={initialResponse.hackathons}
      initialTotal={initialResponse.total}
      initialPage={initialResponse.page}
      initialTotalPages={initialResponse.totalPages}
      initialStats={initialStats}
      lastUpdatedText={lastUpdatedText}
    />
  );
}
