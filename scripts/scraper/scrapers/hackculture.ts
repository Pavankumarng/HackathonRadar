import * as cheerio from 'cheerio';
import type { ScrapedHackathon, HackathonMode } from '../types';
import { toDeadlineISO } from '../utils/parseDate';
import { newPage } from '../utils/browser';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('hackculture');
const URLS = ['https://hackculture.in/hackathons', 'https://hackculture.in'];

function canonicalUrl(raw: string | undefined, base: string): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw, base);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    if (url.hostname !== 'hackculture.in' && !url.hostname.endsWith('.hackculture.in')) return undefined;
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function extractRegistrationDeadline(cardText: string): string | undefined {
  const match = cardText.match(
    /registration\s+(?:ends?|closes?|deadline(?:\s+is)?)\s*(?:on|by|:|-)?\s*((?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?[,]?\s+20\d{2}|20\d{2}-\d{2}-\d{2})/i
  );
  if (!match?.[1]) return undefined;
  const withoutWeekday = match[1].replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?\s+/i, '');
  return toDeadlineISO(withoutWeekday) ?? undefined;
}

function extractMode(text: string): HackathonMode | undefined {
  const value = text.toLowerCase();
  if (value.includes('hybrid')) return 'hybrid';
  if (/\b(virtual|online)\b/.test(value)) return 'online';
  if (/\b(in.person|offline|on.campus)\b/.test(value)) return 'offline';
  return undefined;
}

export async function scrapeHackCulture(): Promise<ScrapedHackathon[]> {
  logger.info('Starting HackCulture scrape');
  const results = new Map<string, ScrapedHackathon>();
  let lastNavigationError: unknown;

  for (const targetUrl of URLS) {
    let page: Awaited<ReturnType<typeof newPage>>['page'] | undefined;
    let context: Awaited<ReturnType<typeof newPage>>['context'] | undefined;

    try {
      const browserPage = await newPage();
      page = browserPage.page;
      context = browserPage.context;

      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      if (response && response.status() >= 400) {
        throw new Error(`HackCulture returned HTTP ${response.status()} for ${targetUrl}`);
      }

      await page.waitForTimeout(1800);
      const html = await page.content();
      const $ = cheerio.load(html);
      const baseUrl = new URL(targetUrl).origin;

      $('[class*="hackathon-card"], [class*="event-card"], article, .card').each((_, element) => {
        const card = $(element);
        const title = card.find('h1, h2, h3, h4, [class*="title"]').first().text().replace(/\s+/g, ' ').trim();
        if (!title || title.length < 3) return;

        const anchor = card.find('a[href]').first();
        const sourceUrl = canonicalUrl(anchor.attr('href'), baseUrl);
        if (!sourceUrl) return;

        const cardText = card.text().replace(/\s+/g, ' ').trim();
        if (/registration\s+(?:closed|has ended)|event\s+(?:ended|completed)/i.test(cardText)) return;

        const registrationEnd = extractRegistrationDeadline(cardText);
        if (!registrationEnd || Date.parse(registrationEnd) <= Date.now()) {
          logger.skipped(sourceUrl, 'No explicit future registration deadline found on the event card');
          return;
        }

        results.set(sourceUrl, {
          title,
          source_site: 'hackculture',
          source_url: sourceUrl,
          mode: extractMode(cardText),
          tags: ['HackCulture'],
          registration_end: registrationEnd,
          rounds: [],
        });
      });

      logger.info(`HackCulture ${targetUrl}: extracted ${results.size} verified events so far`);
      if (results.size > 0) break;
    } catch (error) {
      lastNavigationError = error;
      logger.warn(`HackCulture page failed (${targetUrl}): ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (page) await page.close().catch(() => undefined);
      if (context) await context.close().catch(() => undefined);
    }
  }

  if (results.size === 0 && lastNavigationError) {
    throw lastNavigationError instanceof Error
      ? lastNavigationError
      : new Error('HackCulture could not be reached');
  }

  const output = [...results.values()];
  if (output.length === 0) {
    logger.warn('HackCulture returned no cards with an explicit future registration deadline');
  } else {
    logger.success(`HackCulture complete: ${output.length} verified active events`);
  }
  return output;
}

if (require.main === module) {
  scrapeHackCulture()
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      console.log(`Total: ${results.length}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
