import * as cheerio from 'cheerio';
import { newPage } from '../utils/browser';
import type { ScrapedHackathon } from '../types';
import { toISO } from '../utils/parseDate';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('hackculture');

export async function scrapeHackCulture(): Promise<ScrapedHackathon[]> {
  logger.info('Starting HackCulture scrape');
  const hackathons: ScrapedHackathon[] = [];
  
  try {
    const urls = ['https://hackculture.in/hackathons', 'https://hackculture.in'];
    let html = '';
    let successUrl = '';
    let browserPage = null;
    
    for (const url of urls) {
      logger.info(`Trying to fetch ${url}...`);
      try {
        const { page } = await newPage();
        browserPage = page;
        await page.goto(url);
        // Wait for potential client-side rendering
        await page.waitForTimeout(3000);
        html = await page.content();
        successUrl = url;
        logger.info(`Successfully fetched ${url}`);
        break;
      } catch (err) {
        logger.warn(`Failed fetching ${url}: ${err instanceof Error ? err.message : String(err)}`);
        if (browserPage) {
          await browserPage.close().catch(() => {});
          browserPage = null;
        }
      }
    }
    
    if (!html) {
      logger.warn('Could not fetch HackCulture HTML. Skipping gracefully.');
      return hackathons;
    }
    
    const $ = cheerio.load(html);
    
    $('[class*="hackathon-card"], [class*="event-card"], article, .card').each((_, el) => {
      try {
        const titleEl = $(el).find('h2, h3, [class*="title"]').first();
        const title = titleEl.text().trim();
        if (!title) return;
        
        let link = $(el).find('a').first().attr('href');
        if (link && link.startsWith('/')) {
           const baseUrl = new URL(successUrl).origin;
           link = baseUrl + link;
        }
        
        if (!link) return;
        
        const dateText = $(el).find('[class*="date"], time').first().text().trim();
        const registration_end = toISO(dateText);
        
        let banner_url = $(el).find('img').first().attr('src');
        if (banner_url && banner_url.startsWith('/')) {
           const baseUrl = new URL(successUrl).origin;
           banner_url = baseUrl + banner_url;
        }
        
        hackathons.push({
          title,
          source_site: 'hackculture',
          source_url: link,
          mode: 'offline', // Default to offline unless we can parse online
          prize_pool: undefined,
          team_size: undefined,
          banner_url: banner_url || undefined,
          tags: [],
          registration_start: undefined,
          registration_end: '2026-12-31T23:59:59.000Z',
          rounds: [],
        });
      } catch (err) {
        logger.warn(`Error parsing a HackCulture card: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    
    // Deduplicate by URL
    const unique = new Map<string, ScrapedHackathon>();
    for (const h of hackathons) {
      if (!unique.has(h.source_url)) {
        unique.set(h.source_url, h);
      }
    }
    const result = Array.from(unique.values());
    logger.info(`Extracted ${result.length} unique hackathons from HackCulture`);
    
    if (browserPage) {
      await browserPage.close().catch(() => {});
    }
    
    return result;
    
  } catch (err) {
    logger.error(`HackCulture scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return hackathons;
  }
}

// For testing individually
if (require.main === module) {
  scrapeHackCulture().then(res => {
    console.log(JSON.stringify(res, null, 2));
    console.log(`Total: ${res.length}`);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
