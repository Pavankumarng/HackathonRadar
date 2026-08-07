import { getHackathons, getHackathonStats, type HackathonsResponse } from '@/lib/hackathons';
import { createServerAnonClient } from '@/lib/supabase';
import type { HackathonMode, SourceSite } from '@/types/hackathon';
import HackathonDashboard from '@/components/HackathonDashboard';

export const revalidate = 300; // Next.js ISR (5 minutes default cache revalidation)

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

export default async function Home({ searchParams }: PageProps) {
  // Resolve searchParams promise (Next.js 15+ standard pattern)
  const resolvedParams = await searchParams;
  
  // Format query parameters into types
  const mode = resolvedParams.mode as HackathonMode | undefined;
  const source_site = resolvedParams.source as SourceSite | undefined;
  const search = resolvedParams.search;
  const sort = resolvedParams.sort as any;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const filters = {
    mode,
    source_site,
    search,
    sort,
    page,
    limit: 50
  };

  // 1. Fetch initial list of hackathons (Server-side rendering)
  let initialHackathonsResponse: HackathonsResponse = { hackathons: [], total: 0, page: 1, totalPages: 1 };
  try {
    initialHackathonsResponse = await getHackathons(filters);
  } catch (error) {
    console.error('Failed to load initial hackathons:', error);
  }

  // 2. Fetch initial global stats
  let initialStats = { total: 0, online: 0, offline: 0 };
  try {
    const globalStats = await getHackathonStats();
    initialStats = {
      total: globalStats.total,
      online: globalStats.online,
      offline: globalStats.offline,
    };
  } catch (error) {
    console.error('Failed to load global statistics:', error);
  }

  // 3. Query the DB for the most recent crawled scraped_at timestamp
  let lastUpdatedText = 'Last updated: Unknown';
  try {
    const supabase = createServerAnonClient();
    const { data: latestRow } = await supabase
      .from('hackathons')
      .select('scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRow?.scraped_at) {
      const scrapedDate = new Date(latestRow.scraped_at);
      const diffMs = Date.now() - scrapedDate.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHrs === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        lastUpdatedText = `Last updated: ${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
      } else {
        lastUpdatedText = `Last updated: ${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
      }
    }
  } catch (error) {
    console.error('Failed to resolve latest scrape time:', error);
  }

  return (
    <HackathonDashboard
      initialHackathons={initialHackathonsResponse.hackathons}
      initialTotal={initialHackathonsResponse.total}
      initialPage={initialHackathonsResponse.page}
      initialTotalPages={initialHackathonsResponse.totalPages}
      initialStats={initialStats}
      lastUpdatedText={lastUpdatedText}
    />
  );
}
