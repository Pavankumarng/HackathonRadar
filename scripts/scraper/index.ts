/**
 * Reliable HackathonRadar ingestion orchestrator.
 *
 * - Runs each source independently so one outage does not block other sources.
 * - Rejects invalid URLs and unverified/expired deadlines before persistence.
 * - Preserves fields enriched by other pipeline steps when a source has no value.
 * - Records run telemetry and returns a failing process status on real failures.
 * - Supports SCRAPE_DRY_RUN=true without Supabase credentials or writes.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });
dotenvConfig({ path: resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';
import type { HackathonMode, SourceSite, ScrapedHackathon, RunStats, OrchestratorSummary } from './types';
import { scrapeUnstop } from './scrapers/unstop';
import { scrapeDevpost } from './scrapers/devpost';
import { scrapeHackCulture } from './scrapers/hackculture';
import { makeLogger } from './utils/logger';

const logger = makeLogger('orchestrator');
const DRY_RUN = process.env.SCRAPE_DRY_RUN === 'true';
const SCRAPER_TIMEOUT_MS = 120_000;
const BATCH_SIZE = 20;

type DatabaseJson = Database['public']['Tables']['hackathons']['Row']['rounds'];

function serializeRounds(rounds: ScrapedHackathon['rounds']): DatabaseJson {
  if (!rounds?.length) return [];
  return JSON.parse(JSON.stringify(rounds)) as DatabaseJson;
}

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!url.startsWith('https://')) {
    throw new Error('SUPABASE_URL must be an HTTPS URL');
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'hackathonradar-scraper/1.0' } },
  });
}

async function withTimeout<T>(task: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const SCRAPERS: Array<{ name: SourceSite; run: () => Promise<ScrapedHackathon[]> }> = [
  { name: 'unstop', run: scrapeUnstop },
  { name: 'devpost', run: scrapeDevpost },
  { name: 'hackculture', run: scrapeHackCulture },
];

function expectedHost(source: SourceSite): string {
  switch (source) {
    case 'unstop': return 'unstop.com';
    case 'devpost': return 'devpost.com';
    case 'hackculture': return 'hackculture.in';
  }
}

function validateRecord(item: ScrapedHackathon, source: SourceSite, now: number): string | null {
  if (!item.title?.trim()) return 'Missing title';
  if (item.source_site !== source) return `Source mismatch: expected ${source}, received ${item.source_site}`;
  if (!item.registration_end || !Number.isFinite(Date.parse(item.registration_end))) return 'Missing or invalid registration deadline';
  if (Date.parse(item.registration_end) <= now) return 'Registration deadline has passed';

  try {
    const url = new URL(item.source_url);
    const host = expectedHost(source);
    if (url.protocol !== 'https:' || (url.hostname !== host && !url.hostname.endsWith(`.${host}`))) {
      return `Untrusted source URL host: ${url.hostname}`;
    }
  } catch {
    return 'Invalid source URL';
  }

  if (item.mode && !(['online', 'offline', 'hybrid'] as HackathonMode[]).includes(item.mode)) {
    return 'Invalid event mode';
  }
  return null;
}

interface UpsertOutcome {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function upsertHackathons(
  supabase: AdminClient,
  records: ScrapedHackathon[],
  source: SourceSite,
): Promise<UpsertOutcome> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE);
    const urls = batch.map((record) => record.source_url);

    const { data: previousRows, error: lookupError } = await supabase
      .from('hackathons')
      .select('source_url, mode, prize_pool, team_size, banner_url, tags, ai_summary, registration_start, rounds, venue_name, venue_city, venue_state')
      .in('source_url', urls);

    if (lookupError) {
      const message = `Could not read existing rows for ${source} batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${lookupError.message}`;
      logger.error(message);
      errors.push(message);
      skipped += batch.length;
      continue;
    }

    const existingByUrl = new Map((previousRows ?? []).map((row) => [row.source_url, row]));
    const rows = batch.map((record) => {
      const previous = existingByUrl.get(record.source_url);
      return {
        title: record.title.trim(),
        source_site: source,
        source_url: record.source_url,
        mode: record.mode ?? previous?.mode ?? null,
        prize_pool: record.prize_pool ?? previous?.prize_pool ?? null,
        team_size: record.team_size ?? previous?.team_size ?? null,
        banner_url: record.banner_url ?? previous?.banner_url ?? null,
        tags: record.tags?.length ? record.tags : previous?.tags ?? [],
        ai_summary: record.ai_summary ?? previous?.ai_summary ?? null,
        registration_start: record.registration_start ?? previous?.registration_start ?? null,
        registration_end: record.registration_end,
        rounds: record.rounds?.length ? serializeRounds(record.rounds) : previous?.rounds ?? [],
        venue_name: record.venue_name ?? previous?.venue_name ?? null,
        venue_city: record.venue_city ?? previous?.venue_city ?? null,
        venue_state: record.venue_state ?? previous?.venue_state ?? null,
        scraped_at: nowIso,
        updated_at: nowIso,
        is_active: true,
      };
    });

    const { data, error } = await supabase
      .from('hackathons')
      .upsert(rows, { onConflict: 'source_url', ignoreDuplicates: false })
      .select('source_url');

    if (error) {
      const message = `Upsert failed for ${source} batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${error.message}`;
      logger.error(message);
      errors.push(message);
      skipped += batch.length;
      continue;
    }

    const returnedCount = data?.length ?? 0;
    if (returnedCount !== batch.length) {
      const message = `Upsert returned ${returnedCount}/${batch.length} rows for ${source}`;
      logger.error(message);
      errors.push(message);
      skipped += batch.length - returnedCount;
    }

    for (const row of data ?? []) {
      if (existingByUrl.has(row.source_url)) updated++;
      else inserted++;
    }
  }

  return { inserted, updated, skipped, errors };
}

async function expireOldHackathons(supabase: AdminClient): Promise<number> {
  const { data, error } = await supabase.rpc('expire_old_hackathons_count');
  if (!error) {
    const count = Number(data ?? 0);
    logger.success(`Expired ${count} hackathons`);
    return count;
  }

  logger.warn(`Count-returning expiry RPC unavailable; using safe fallback: ${error.message}`);
  const { data: changedRows, error: updateError } = await supabase
    .from('hackathons')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('registration_end', new Date().toISOString())
    .select('id');

  if (updateError) throw new Error(`Expiry fallback failed: ${updateError.message}`);
  return changedRows?.length ?? 0;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  logger.info('════════ HackathonRadar scraper started ════════');
  logger.info(`Started at: ${startedAt}; dry run: ${DRY_RUN}`);

  const supabase = DRY_RUN ? null : getSupabaseAdmin();
  const perSource: RunStats[] = [];
  let hadFailure = false;
  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const scraper of SCRAPERS) {
    const { name, run } = scraper;
    const started = Date.now();
    const errors: string[] = [];
    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    logger.info(`Starting source: ${name}`);
    try {
      const records = await withTimeout(run(), SCRAPER_TIMEOUT_MS, name);
      fetched = records.length;
      const now = Date.now();
      const seen = new Set<string>();
      const valid: ScrapedHackathon[] = [];

      for (const record of records) {
        const validationError = validateRecord(record, name, now);
        if (validationError) {
          skipped++;
          logger.skipped(record.source_url || record.title, validationError);
          continue;
        }
        if (seen.has(record.source_url)) {
          skipped++;
          logger.skipped(record.source_url, 'Duplicate source URL within scrape batch');
          continue;
        }
        seen.add(record.source_url);
        valid.push(record);
      }

      if (valid.length === 0) {
        logger.warn(`${name} returned zero verified active listings (fetched ${fetched})`);
      } else if (DRY_RUN) {
        logger.info(`Dry run: ${valid.length} ${name} records validated; no database writes performed`);
      } else if (supabase) {
        const outcome = await upsertHackathons(supabase, valid, name);
        inserted = outcome.inserted;
        updated = outcome.updated;
        skipped += outcome.skipped;
        errors.push(...outcome.errors);
        if (outcome.errors.length) hadFailure = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      hadFailure = true;
      logger.error(`Source ${name} failed: ${message}`);
    }

    const upserted = inserted + updated;
    const stats: RunStats = { source: name, fetched, upserted, inserted, updated, skipped, errors };
    perSource.push(stats);
    totalFetched += fetched;
    totalInserted += inserted;
    totalUpdated += updated;
    totalSkipped += skipped;
    logger.info(`${name} completed in ${((Date.now() - started) / 1000).toFixed(1)}s: fetched=${fetched}, inserted=${inserted}, updated=${updated}, skipped=${skipped}`);
  }

  let totalExpired = 0;
  if (!DRY_RUN && supabase) {
    try {
      totalExpired = await expireOldHackathons(supabase);
    } catch (error) {
      hadFailure = true;
      logger.error(`Expiry step failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    logger.info('Dry run: expiry step skipped');
  }

  const finishedAt = new Date().toISOString();
  const summary: OrchestratorSummary = {
    startedAt,
    finishedAt,
    dryRun: DRY_RUN,
    totalFetched,
    totalNew: totalInserted,
    totalUpdated,
    totalUpserted: totalInserted + totalUpdated,
    totalSkipped,
    totalExpired,
    perSource,
  };

  if (!DRY_RUN && supabase) {
    const results = Object.fromEntries(perSource.map((item) => [
      item.source,
      { fetched: item.fetched, inserted: item.inserted, updated: item.updated, skipped: item.skipped },
    ]));
    const errors = Object.fromEntries(perSource.filter((item) => item.errors.length).map((item) => [item.source, item.errors]));

    const { error: logError } = await supabase.from('scrape_runs').insert({
      started_at: startedAt,
      finished_at: finishedAt,
      results,
      errors,
    });
    if (logError) {
      hadFailure = true;
      logger.error(`Failed to persist scrape run: ${logError.message}`);
    }
  }

  logger.info('════════ HackathonRadar scraper summary ════════');
  logger.info(JSON.stringify(summary, null, 2));
  console.log('[SCRAPER_SUMMARY_JSON]');
  console.log(JSON.stringify(summary, null, 2));

  if (hadFailure) {
    logger.error('Scraper run completed with one or more failures');
    process.exitCode = 1;
  } else {
    logger.success('Scraper run completed without reported errors');
    process.exitCode = 0;
  }
}

main().catch((error) => {
  logger.error('FATAL: scraper orchestrator crashed', error);
  process.exitCode = 1;
});
