import type { ScrapedHackathon, Round, HackathonMode } from '../types';
import { toDeadlineISO, toISO } from '../utils/parseDate';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('unstop');
const SEARCH_ENDPOINT = 'https://unstop.com/api/public/opportunity/search-result';
const PER_PAGE = 30;
const MAX_PAGES = 12;
const REQUEST_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; HackathonRadar/1.0; +https://hackathon-radar-alpha.vercel.app)',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  Referer: 'https://unstop.com/hackathons',
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function resolveUnstopUrl(item: UnknownRecord): string | undefined {
  const candidate = text(item.public_url) || text(item.seo_url) || text(item.url);
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate, 'https://unstop.com');
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    if (url.hostname !== 'unstop.com' && !url.hostname.endsWith('.unstop.com')) return undefined;
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function extractMode(item: UnknownRecord): HackathonMode | undefined {
  const value = [
    text(item.region),
    text(item.opportunity_type),
    text(item.mode),
    text(item.event_mode),
  ].filter(Boolean).join(' ').toLowerCase();

  if (/hybrid/.test(value)) return 'hybrid';
  if (/online|virtual|remote/.test(value)) return 'online';
  if (/offline|in[-_ ]?person|on[-_ ]?campus/.test(value)) return 'offline';
  return undefined;
}

function extractTags(item: UnknownRecord): string[] {
  const values: string[] = [];
  for (const candidate of [item.tags, item.filters]) {
    if (!Array.isArray(candidate)) continue;
    for (const entry of candidate) {
      const record = asRecord(entry);
      const value = text(entry) || text(record.name) || text(record.value) || text(record.label);
      if (value && value.length <= 48) values.push(value);
    }
  }
  return [...new Set(values)].slice(0, 8);
}

function extractPrize(item: UnknownRecord): string | undefined {
  const prizes = Array.isArray(item.prizes) ? item.prizes : [];
  const amounts = prizes
    .map((entry) => {
      const prize = asRecord(entry);
      const amount = Number(prize.cash ?? prize.amount ?? prize.prize_amount);
      return Number.isFinite(amount) && amount > 0 ? amount : 0;
    })
    .filter((amount) => amount > 0);

  if (amounts.length > 0) {
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    return '₹' + total.toLocaleString('en-IN');
  }

  const raw = item.prize_amount ?? item.total_prize;
  if (raw === null || raw === undefined || String(raw).trim() === '') return undefined;
  if (typeof raw === 'number' || /^\d+(?:\.\d+)?$/.test(String(raw).trim())) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return undefined;
    const currency = (text(item.prize_currency) || 'INR').toUpperCase();
    if (currency === 'INR' || currency === '₹') return '₹' + amount.toLocaleString('en-IN');
    if (currency === 'USD' || currency === '$') return '$' + amount.toLocaleString('en-US');
    return amount.toLocaleString() + ' ' + currency;
  }
  return String(raw).replace(/<[^>]*>/g, '').trim() || undefined;
}

function extractTeamSize(item: UnknownRecord): string | undefined {
  const requirements = asRecord(item.regnRequirements ?? item.registration_requirements);
  const team = asRecord(item.team_size ?? requirements.team_size);
  const minimum = Number(team.min ?? requirements.min_team_size ?? item.min_team_size);
  const maximum = Number(team.max ?? requirements.max_team_size ?? item.max_team_size);

  if (Number.isInteger(minimum) && Number.isInteger(maximum) && minimum > 0 && maximum >= minimum) {
    if (minimum === 1 && maximum === 1) return 'Individual';
    return minimum === maximum ? `${minimum} members` : `${minimum}–${maximum} members`;
  }
  if (Number.isInteger(maximum) && maximum === 1) return 'Individual';
  return undefined;
}

function extractRounds(item: UnknownRecord): Round[] {
  if (!Array.isArray(item.rounds)) return [];
  const rounds: Round[] = [];
  for (const entry of item.rounds) {
    const round = asRecord(entry);
    const start = toISO(text(round.start_date) || text(round.startDate));
    const end = toISO(text(round.end_date) || text(round.endDate) || text(round.start_date));
    if (!start || !end) continue;
    const modeText = (text(round.type) || text(round.mode) || '').toLowerCase();
    rounds.push({
      name: text(round.title) || text(round.name) || `Round ${rounds.length + 1}`,
      type: /offline|in.person/.test(modeText) ? 'offline' : 'online',
      start_date: start,
      end_date: end,
      location: text(round.location),
    });
  }
  return rounds;
}

function deadlineValue(item: UnknownRecord): string | undefined {
  const requirements = asRecord(item.regnRequirements ?? item.registration_requirements);
  return text(requirements.end_regn_dt) ||
    text(item.registration_end) ||
    text(item.registrationEndDate) ||
    text(item.regn_end_date) ||
    text(item.deadline);
}

function registrationStartValue(item: UnknownRecord): string | undefined {
  const requirements = asRecord(item.regnRequirements ?? item.registration_requirements);
  return text(requirements.start_regn_dt) ||
    text(item.registration_start) ||
    text(item.registrationStartDate) ||
    text(item.regn_start_date);
}

async function fetchPage(page: number): Promise<{ items: UnknownRecord[]; lastPage?: number }> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('opportunity', 'hackathons');
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('oppstatus', 'open');

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 10_000)
          : attempt * 1000;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
      }
      if (!response.ok) throw new Error(`Unstop returned HTTP ${response.status}`);
      const json: unknown = await response.json();
      const root = asRecord(json);
      const data = asRecord(root.data);
      const items = Array.isArray(data.data) ? data.data : [];
      const lastPage = Number(data.last_page ?? data.lastPage ?? root.last_page);
      return {
        items: items.map(asRecord),
        lastPage: Number.isInteger(lastPage) && lastPage > 0 ? lastPage : undefined,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unstop request failed');
}

export async function scrapeUnstop(): Promise<ScrapedHackathon[]> {
  logger.info('Starting Unstop paginated API scrape');
  const results = new Map<string, ScrapedHackathon>();
  const now = Date.now();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, lastPage } = await fetchPage(page);
    logger.info(`Unstop page ${page}: received ${items.length} records`);
    if (items.length === 0) break;

    for (const item of items) {
      const title = text(item.title);
      const sourceUrl = resolveUnstopUrl(item);
      if (!title || !sourceUrl) continue;

      const rawDeadline = deadlineValue(item);
      const registrationEnd = toDeadlineISO(rawDeadline);
      if (!registrationEnd) {
        logger.skipped(sourceUrl, `No verified registration deadline (raw: ${rawDeadline ?? 'missing'})`);
        continue;
      }
      if (Date.parse(registrationEnd) <= now) continue;

      const rawStart = registrationStartValue(item);
      const registrationStart = rawStart ? toISO(rawStart) ?? undefined : undefined;
      const organization = asRecord(item.organisation ?? item.organization);
      const address = asRecord(item.address_with_country_logo);

      results.set(sourceUrl, {
        title,
        source_site: 'unstop',
        source_url: sourceUrl,
        mode: extractMode(item),
        prize_pool: extractPrize(item),
        team_size: extractTeamSize(item),
        tags: extractTags(item),
        registration_start: registrationStart,
        registration_end: registrationEnd,
        rounds: extractRounds(item),
        venue_name: text(organization.name) || text(item.venue_name),
        venue_city: text(address.city) || text(item.city),
        venue_state: text(address.state) || text(item.state),
      });
    }

    if ((lastPage && page >= lastPage) || items.length < PER_PAGE) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const output = [...results.values()];
  logger.success(`Unstop complete: ${output.length} verified active hackathons from up to ${MAX_PAGES} pages`);
  return output;
}

if (require.main === module) {
  scrapeUnstop()
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      console.log(`Total: ${results.length}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
