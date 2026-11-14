import type { ScrapedHackathon, Round, HackathonMode, ScraperBatch } from '../types';
import { toDeadlineISO, toISO } from '../utils/parseDate';
import { makeLogger } from '../utils/logger';
import { normalizeUnstopEventUrl } from '../../../src/lib/urls/unstop';
import { extractUnstopRegistrationDeadline } from '../utils/unstopDeadline';

const logger = makeLogger('unstop');
const SEARCH_ENDPOINT = 'https://unstop.com/api/public/opportunity/search-result';
const PER_PAGE = 15;
const MAX_PAGES = Math.max(1, Math.min(50, Number(process.env.SCRAPER_MAX_PAGES) || 50));
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
  // Some API records contain both display and SEO URLs. Prefer the first
  // candidate that resolves to a real event page, not merely the first string.
  const candidates = [item.public_url, item.seo_url, item.url]
    .map(text)
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const normalized = normalizeUnstopEventUrl(candidate);
    if (normalized) return normalized;
  }
  return undefined;
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
  return extractUnstopRegistrationDeadline(item);
}

function registrationStartValue(item: UnknownRecord): string | undefined {
  const requirements = asRecord(item.regnRequirements ?? item.registration_requirements);
  return text(requirements.start_regn_dt) ||
    text(item.registration_start) ||
    text(item.registrationStartDate) ||
    text(item.regn_start_date);
}

async function fetchPage(page: number): Promise<{ items: UnknownRecord[]; lastPage?: number; totalCount?: number }> {
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
      const pagination = asRecord(data.pagination ?? root.pagination);
      const lastPage = Number(data.last_page ?? data.lastPage ?? pagination.last_page ?? root.last_page);
      const totalCount = Number(data.total ?? data.total_count ?? pagination.total ?? pagination.total_count ?? root.total);
      return {
        items: items.map(asRecord),
        lastPage: Number.isInteger(lastPage) && lastPage > 0 ? lastPage : undefined,
        totalCount: Number.isInteger(totalCount) && totalCount > 0 ? totalCount : undefined,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unstop request failed');
}

export async function scrapeUnstop(): Promise<ScraperBatch> {
  logger.info('Starting Unstop paginated API scrape');
  const results = new Map<string, ScrapedHackathon>();
  const observedUrls = new Set<string>();
  const now = Date.now();

  let observedCount = 0;
  let pagesFetched = 0;
  let lastItemsCount = 0;
  let lastPage: number | undefined;
  let totalCount: number | undefined;
  let paginationMetadataPresent = false;
  let integrityError = false;
  let completionReason = 'maximum page limit reached';

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetchPage(page);
    const { items } = response;
    lastPage = response.lastPage;
    totalCount = response.totalCount;
    paginationMetadataPresent = Boolean(lastPage || totalCount !== undefined);
    pagesFetched++;
    observedCount += items.length;
    lastItemsCount = items.length;

    logger.info(`Unstop page ${page}: received ${items.length} records`);
    if (items.length === 0) {
      completionReason = page === 1 ? 'empty first page; refusing to reconcile' : 'empty final page';
      break;
    }

    for (const item of items) {
      const title = text(item.title);
      const sourceUrl = resolveUnstopUrl(item);
      if (!title || !sourceUrl) {
        integrityError = true;
        logger.warn('Unstop returned a listing without a valid title or event URL; snapshot cannot be reconciled');
        continue;
      }
      observedUrls.add(sourceUrl);

      const rawDeadline = deadlineValue(item);
      const registrationEnd = toDeadlineISO(rawDeadline);
      if (!registrationEnd) {
        integrityError = true;
        logger.skipped(sourceUrl, `No explicit registration deadline (raw: ${rawDeadline ?? 'missing'}); snapshot cannot be reconciled`);
        continue;
      }

      // The opportunity is present in the source snapshot, but its verified
      // registration cutoff has passed. Do not emit it as an active record.
      if (Date.parse(registrationEnd) <= now) {
        logger.info(`Unstop listing is already past its registration cutoff: ${title}`);
        continue;
      }

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

    if (response.lastPage && page >= response.lastPage) {
      completionReason = 'reached advertised last page';
      break;
    }
    if (response.totalCount !== undefined && observedCount >= response.totalCount) {
      completionReason = 'reached advertised total count';
      break;
    }
    if (!response.lastPage && response.totalCount === undefined && items.length < PER_PAGE) {
      completionReason = 'received a short final page';
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const metadataComplete =
    (lastPage !== undefined ? pagesFetched >= lastPage : true) &&
    (totalCount !== undefined ? observedCount >= totalCount : true);
  const shortPageComplete = lastItemsCount < PER_PAGE && !paginationMetadataPresent;
  const paginationComplete = metadataComplete || shortPageComplete;
  const snapshotComplete =
    observedCount > 0 &&
    paginationComplete &&
    !integrityError;

  if (observedCount === 0) {
    logger.warn('Unstop returned an empty snapshot; no existing records will be reconciled');
  } else if (integrityError) {
    logger.warn('Unstop snapshot contains records with unverified registration dates or URLs; no existing records will be reconciled');
  } else if (!paginationComplete) {
    logger.warn(`Unstop pagination is incomplete after ${pagesFetched} pages; no existing records will be reconciled`);
  }

  const output = [...results.values()];
  logger.success(
    `Unstop complete: ${output.length} active listings from ${observedCount} observed rows, ${pagesFetched} pages; snapshotComplete=${snapshotComplete} (${completionReason})`,
  );

  return {
    records: output,
    observedUrls: [...observedUrls],
    observedCount,
    pagesFetched,
    snapshotComplete,
    completionReason,
    advertisedTotal: totalCount,
  };
}
if (require.main === module) {
  scrapeUnstop()
    .then((batch) => {
      console.log(JSON.stringify(batch, null, 2));
      console.log(`Total active listings: ${batch.records.length}`);
      console.log(`Observed source rows: ${batch.observedCount}`);
      console.log(`Pages fetched: ${batch.pagesFetched}`);
      console.log(`Snapshot complete: ${batch.snapshotComplete}`);
      console.log(`Completion reason: ${batch.completionReason}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
