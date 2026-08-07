import { newPage } from '../utils/browser';
import type { ScrapedHackathon } from '../types';
import { toISO } from '../utils/parseDate';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('devpost');

export async function scrapeDevpost(): Promise<ScrapedHackathon[]> {
  logger.info('Starting Devpost scrape (DOM Extraction)');
  const hackathons: ScrapedHackathon[] = [];
  
  try {
    const { page } = await newPage();
    const url = `https://devpost.com/hackathons`;
    logger.info(`Navigating to ${url}`);
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Give it time to load cards
    await page.waitForSelector('.hackathon-tile, .software-entry, article', { timeout: 15000 }).catch(() => {});
    
    // Scroll down 15 times to load more hackathons
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
      
      const items = await page.$$eval('.hackathon-tile, .software-entry, article.clearfix', els => {
        return els.map(el => {
          const titleEl = el.querySelector('h3, .title');
          const urlEl = el.querySelector('a') || el.closest('a');
          const dateEl = el.querySelector('.submission-period, .date, [data-role="date"]');
          const prizeEl = el.querySelector('.prize-amount, .prize');
          const themeEls = el.querySelectorAll('.theme, .label, .tag');
          
          return {
            title: titleEl?.textContent?.trim(),
            url: urlEl?.getAttribute('href'),
            dateText: dateEl?.textContent?.trim(),
            prizeText: prizeEl?.textContent?.trim(),
            themes: Array.from(themeEls).map(t => t.textContent?.trim()).filter(Boolean)
          };
        });
      });
      
      logger.info(`Devpost DOM returned ${items.length} hackathons`);
      
      for (const item of items) {
        try {
          if (!item.title || !item.url) continue;
          
          let link = item.url;
          if (!link.startsWith('http')) {
            link = `https://${link.replace(/^\/\//, '')}`;
          }
          
          let registration_end = undefined;
          let registration_start = undefined;
          if (item.dateText) {
            const parts = item.dateText.split('-');
            if (parts.length === 2) {
               registration_start = toISO(parts[0].trim());
               registration_end = toISO(parts[1].trim());
            } else {
               registration_end = toISO(item.dateText);
            }
          }

          // Devpost lists them as live/upcoming, so if parsing fails, set a default future date
          // to ensure they are not dropped by the orchestrator.
          if (!registration_end) {
             registration_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }
          
          hackathons.push({
            title: item.title.replace('Featured', '').trim(),
            source_site: 'devpost',
            source_url: link,
            mode: 'online',
            prize_pool: item.prizeText || undefined,
            team_size: undefined,
            tags: (item.themes || []) as string[],
            registration_start: registration_start || undefined,
            registration_end: registration_end,
            rounds: [],
          });
        } catch (err: any) {
          logger.warn(`Skipped a Devpost item: ${err.message}`);
        }
      }
  } catch (err) {
    logger.error(`Devpost scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  
  return hackathons;
}

// For testing individually
if (require.main === module) {
  scrapeDevpost().then(res => {
    console.log(JSON.stringify(res, null, 2));
    console.log(`Total: ${res.length}`);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
