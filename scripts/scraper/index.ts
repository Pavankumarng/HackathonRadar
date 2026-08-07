/**
 * scripts/scraper/index.ts
 *
 * HackRadar — Main Scraper Orchestrator
 *
 * Runs all active platform scrapers in sequence, upserts to Supabase immediately
 * after each finishes, generates Gemini AI summaries for new records, expires
 * past hackathons, and logs the run to the `scrape_runs` table.
 *
 * Usage:
 *   npm run scrape
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });
dotenvConfig({ path: resolve(process.cwd(), '.env') });
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';
import type { ScrapedHackathon, RunStats, OrchestratorSummary } from './types';

import { scrapeUnstop } from './scrapers/unstop';
import { scrapeDevpost } from './scrapers/devpost';
import { scrapeHackCulture } from './scrapers/hackculture';

import { makeLogger } from './utils/logger';

const logger = makeLogger('orchestrator');

// ─── Supabase admin client (service role — bypasses RLS) ─────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[orchestrator] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function timeout(ms: number, msg: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}

// ─── Scraper registry ─────────────────────────────────────────────────────────

const SCRAPERS: Array<{ name: ScrapedHackathon['source_site']; fn: () => Promise<ScrapedHackathon[]> }> = [
  { name: 'unstop',      fn: scrapeUnstop },
  { name: 'devpost',     fn: scrapeDevpost },
  { name: 'hackculture', fn: scrapeHackCulture },
];

// ─── Upsert helpers ───────────────────────────────────────────────────────────

async function upsertHackathons(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  hackathons: ScrapedHackathon[],
  source: string
): Promise<{ upserted: number; skipped: number; newIds: string[]; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;
  let skipped = 0;
  const newIds: string[] = [];

  const BATCH_SIZE = 20;
  for (let i = 0; i < hackathons.length; i += BATCH_SIZE) {
    const batch = hackathons.slice(i, i + BATCH_SIZE);

    const rows = batch.map((h) => ({
      title: h.title,
      source_site: h.source_site,
      source_url: h.source_url,
      mode: h.mode ?? null,
      prize_pool: h.prize_pool ?? null,
      team_size: h.team_size ?? null,
      banner_url: null, // Images disabled by user request
      tags: h.tags ?? [],
      ai_summary: null, // populated separately by Gemini step
      registration_start: h.registration_start ?? null,
      registration_end: h.registration_end,
      rounds: (h.rounds ?? []) as unknown,
      venue_name: h.venue_name ?? null,
      venue_city: h.venue_city ?? null,
      venue_state: h.venue_state ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('hackathons')
      .upsert(rows, {
        onConflict: 'source_url',
        ignoreDuplicates: false,
      })
      .select('id, source_url');

    if (error) {
      const msg = `Batch upsert error (${source} batch ${i / BATCH_SIZE + 1}): ${error.message}`;
      logger.error(msg);
      errors.push(msg);
      skipped += batch.length;
    } else {
      upserted += data?.length ?? 0;
      newIds.push(...(data?.map((r) => r.id) ?? []));
    }
  }

  return { upserted, skipped, newIds, errors };
}



// ─── Expire step ──────────────────────────────────────────────────────────────

async function runExpireHackathons(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  logger.info('Running expire_old_hackathons()');

  const { error: fnError } = await supabase.rpc('expire_old_hackathons');
  if (fnError) {
    logger.warn('RPC expire_old_hackathons failed, falling back to direct update', fnError);
    const { data, error: updateError } = await supabase
      .from('hackathons')
      .update({ is_active: false })
      .lt('registration_end', new Date().toISOString())
      .eq('is_active', true)
      .select('id');

    if (updateError) {
      logger.error('Fallback expire failed', updateError);
      return 0;
    }
    const count = data?.length ?? 0;
    logger.success(`Expired ${count} hackathons (fallback)`);
    return count;
  }

  const { count } = await supabase
    .from('hackathons')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', false)
    .lt('registration_end', new Date().toISOString());

  logger.success(`Expire function completed. Total inactive: ${count ?? '?'}`);
  return 0;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  logger.info('═══════════════════════════════════════');
  logger.info('  HackRadar Scraper — Starting Run');
  logger.info(`  Started at: ${startedAt}`);
  logger.info('═══════════════════════════════════════');

  const supabase = getSupabaseAdmin();
  const perSource: RunStats[] = [];
  const siteErrors: Record<string, string> = {};

  let totalFetched = 0;
  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const { name, fn } of SCRAPERS) {
    logger.info(`\n─── Starting scraper: ${name} ───`);
    const scraperStart = Date.now();

    let fetched = 0;
    let upserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      // FIX 1: Promise.race for timeouts
      const hackathons = await Promise.race([
        fn(),
        timeout(120_000, `${name} timed out after 2 minutes`),
      ]);
      fetched = hackathons.length;

      const valid = hackathons.filter((h) => {
        if (!h.registration_end) {
          logger.warn(`[${name}] Dropping "${h.title}" — no registration_end`);
          skipped++;
          return false;
        }
        return true;
      });

      const seen = new Set<string>();
      const deduped = valid.filter((h) => {
        if (seen.has(h.source_url)) {
          logger.warn(`[${name}] Duplicate source_url: ${h.source_url}`);
          skipped++;
          return false;
        }
        seen.add(h.source_url);
        return true;
      });

      logger.info(`[${name}] Fetched: ${fetched}, valid: ${deduped.length}, pre-skip: ${skipped}`);

      if (deduped.length > 0) {
        // FIX 1: Save immediately after each scraper
        const { upserted: u, skipped: s, errors: e } = await upsertHackathons(supabase, deduped, name);
        upserted += u;
        skipped += s;
        errors.push(...e);
        logger.success(`✓ ${name}: saved ${upserted} hackathons`);
      }

      const elapsedSec = ((Date.now() - scraperStart) / 1000).toFixed(1);
      logger.success(`[${name}] Done in ${elapsedSec}s — upserted: ${upserted}, skipped: ${skipped}`);
    } catch (err) {
      const msg = `[${name}] Scraper failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(`✗ ${msg}`);
      errors.push(msg);
      siteErrors[name] = msg;
    }

    perSource.push({ source: name, fetched, upserted, skipped, errors });
    totalFetched += fetched;
    totalUpserted += upserted;
    totalSkipped += skipped;

    logger.info(`[orchestrator] Pausing 3s before next scraper...`);
    await new Promise((r) => setTimeout(r, 3000));
  }



  // ── Expire old hackathons ───────────────────────────────────────────────
  logger.info('\n─── Expire Old Hackathons ───');
  const totalExpired = await runExpireHackathons(supabase);

  // ── Final summary and Log ─────────────────────────────────────────────────
  const finishedAt = new Date().toISOString();
  
  // FIX 6: Add to scrape_runs table
  try {
    const resultsObj: Record<string, number> = {};
    for (const stat of perSource) {
      resultsObj[stat.source] = stat.upserted;
    }
    
    await supabase.from('scrape_runs').insert([{
      started_at: startedAt,
      finished_at: finishedAt,
      results: resultsObj,
      errors: siteErrors
    }] as any);
    logger.info('Logged run statistics to scrape_runs table.');
  } catch (err) {
    logger.error('Failed to log scrape run', err);
  }

  const summary: OrchestratorSummary = {
    startedAt,
    finishedAt,
    totalFetched,
    totalNew: totalUpserted,
    totalUpdated: 0,
    totalSkipped,
    totalExpired,
    perSource,
  };

  logger.info('\n═══════════════════════════════════════');
  logger.info('  HackRadar Scraper — Run Complete');
  logger.info(`  Finished at  : ${finishedAt}`);
  logger.info(`  Total fetched: ${totalFetched}`);
  logger.info(`  Total upserted: ${totalUpserted}`);
  logger.info(`  Total skipped: ${totalSkipped}`);
  logger.info(`  Total expired: ${totalExpired}`);
  logger.info('  Per source:');
  for (const stat of perSource) {
    const errStr = stat.errors.length > 0 ? ` ⚠ ${stat.errors.length} error(s)` : '';
    logger.info(`    ${stat.source.padEnd(12)}: fetched=${stat.fetched} upserted=${stat.upserted} skipped=${stat.skipped}${errStr}`);
  }
  logger.info('═══════════════════════════════════════\n');

  console.log('\n[SCRAPER_SUMMARY_JSON]');
  console.log(JSON.stringify(summary, null, 2));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main().catch((err) => {
  logger.error('FATAL: Orchestrator crashed', err);
  process.exit(1);
});
