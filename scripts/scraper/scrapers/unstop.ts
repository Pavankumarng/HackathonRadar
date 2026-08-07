import type { ScrapedHackathon } from '../types';
import { toISO } from '../utils/parseDate';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('unstop');

export async function scrapeUnstop(): Promise<ScrapedHackathon[]> {
  logger.info('Starting Unstop scrape');
  const hackathons: ScrapedHackathon[] = [];
  
  try {
    const targetUrl = 'https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=15&oppstatus=open';
    logger.info(`Fetching Unstop API: ${targetUrl}`);
    
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error(`Unstop API returned ${res.status}`);
    
    const json = await res.json();
    let items: any[] = [];
    if (json?.data?.data) {
      items = json.data.data;
      logger.info(`Fetched ${items.length} items from Unstop API natively`);
    }
      
    for (const item of items) {
      try {
        const title = item.title;
        const source_url = item.public_url ? `https://unstop.com/hackathons/${item.public_url}` : item.seo_url;
        if (!title || !source_url) continue;
        
        let registration_end = item.end_date ? toISO(item.end_date) : undefined;
        let registration_start = item.start_date ? toISO(item.start_date) : undefined;
        
        let mode: 'online' | 'offline' | 'hybrid' = 'offline';
        if (item.opportunity_type?.toLowerCase() === 'online') {
          mode = 'online';
        }
        
        let prize_pool = undefined;
        if (item.prize_amount && item.prize_currency) {
          prize_pool = `${item.prize_amount} ${item.prize_currency}`;
        }
        
        const tags = Array.isArray(item.tags) ? item.tags.map((t: any) => t.value || t) : [];
        
        hackathons.push({
          title,
          source_site: 'unstop',
          source_url,
          mode,
          prize_pool,
          team_size: undefined,
          tags,
          registration_start: registration_start || undefined,
          registration_end: registration_end || '2026-12-31T23:59:59.000Z',
          rounds: Array.isArray(item.rounds) ? item.rounds : [],
          venue_city: item.city || undefined,
          venue_state: item.state || undefined,
        });
      } catch (err) {
        logger.warn(`Failed parsing Unstop item: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    logger.error(`Unstop scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  
  return hackathons;
}

// For testing individually
if (require.main === module) {
  scrapeUnstop().then(res => {
    console.log(JSON.stringify(res, null, 2));
    console.log(`Total: ${res.length}`);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
