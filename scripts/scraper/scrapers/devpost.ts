import type { ScrapedHackathon, HackathonMode } from '../types';
import { parseDateRange } from '../utils/parseDate';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('devpost');
const API_URL = 'https://devpost.com/api/hackathons';
const MAX_PAGES = 12;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function canonicalDevpostUrl(raw: unknown): string | undefined {
  const value = stringValue(raw);
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://devpost.com');
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    if (url.hostname !== 'devpost.com' && !url.hostname.endsWith('.devpost.com')) return undefined;
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function cleanPrize(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || /^\$?0(?:\.0+)?$/.test(raw)) return undefined;
  return raw;
}

function extractThemes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      return stringValue(asRecord(entry).name) || stringValue(asRecord(entry).title) || '';
    })
    .filter((tag) => tag && tag.length <= 48);
  return [...new Set(tags)].slice(0, 8);
}

function extractMode(item: UnknownRecord): HackathonMode | undefined {
  const location = stringValue(asRecord(item.displayed_location).location) ||
    stringValue(item.displayed_location) ||
    stringValue(item.location);
  if (!location) return undefined;
  const normalized = location.toLowerCase();
  if (normalized.includes('hybrid')) return 'hybrid';
  if (normalized === 'online' || normalized.includes('everywhere') || normalized.includes('virtual')) return 'online';
  if (normalized.includes('in-person') || normalized.includes('in person') || normalized.includes('offline')) return 'offline';
  return undefined;
}

async function fetchPage(page: number): Promise<{ items: UnknownRecord[]; totalCount?: number; perPage?: number }> {
  const url = new URL(API_URL);
  url.searchParams.append('status[]', 'open');
  url.searchParams.append('status[]', 'upcoming');
  url.searchParams.set('page', String(page));

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HackathonRadar/1.0)',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://devpost.com/hackathons',
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < 3) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await new Promise((resolve) =>
            setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 10_000)
              : attempt * 1500)
          );
          continue;
        }
      }
      if (!response.ok) throw new Error(`Devpost API returned HTTP ${response.status}`);

      const json: unknown = await response.json();
      const root = asRecord(json);
      const items = Array.isArray(root.hackathons) ? root.hackathons : [];
      const meta = asRecord(root.meta);
      const totalCount = Number(meta.total_count);
      const perPage = Number(meta.per_page);
      return {
        items: items.map(asRecord),
        totalCount: Number.isFinite(totalCount) && totalCount > 0 ? totalCount : undefined,
        perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : undefined,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Devpost API request failed');
}

export async function scrapeDevpost(): Promise<ScrapedHackathon[]> {
  logger.info('Starting Devpost public listing API scrape');
  const results = new Map<string, ScrapedHackathon>();
  const now = Date.now();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, totalCount, perPage } = await fetchPage(page);
    logger.info(`Devpost page ${page}: received ${items.length} records`);
    if (items.length === 0) break;

    for (const item of items) {
      const title = stringValue(item.title);
      const sourceUrl = canonicalDevpostUrl(item.url);
      if (!title || !sourceUrl) continue;

      const rawDateRange = stringValue(item.submission_period_dates) ||
        stringValue(item.submission_period);
      const range = parseDateRange(rawDateRange);
      if (!range) {
        logger.skipped(sourceUrl, `Missing or unparseable year-qualified submission period: ${rawDateRange ?? 'missing'}`);
        continue;
      }
      if (Date.parse(range.end) <= now) continue;

      results.set(sourceUrl, {
        title: title.replace(/^Featured\s*/i, '').trim(),
        source_site: 'devpost',
        source_url: sourceUrl,
        mode: extractMode(item),
        prize_pool: cleanPrize(item.prize_amount),
        tags: extractThemes(item.themes),
        registration_start: range.start || undefined,
        registration_end: range.end,
        rounds: [],
      });
    }

    if ((totalCount && perPage && page * perPage >= totalCount) || items.length < (perPage || 40)) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const output = [...results.values()];
  logger.success(`Devpost complete: ${output.length} verified active listings`);
  return output;
}

if (require.main === module) {
  scrapeDevpost()
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      console.log(`Total: ${results.length}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
