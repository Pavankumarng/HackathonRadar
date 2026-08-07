/**
 * scripts/scraper/types.ts
 *
 * Types used exclusively by the scraper scripts.
 * These must NEVER be imported from src/ (Next.js frontend).
 */

// ─── Round type (must match src/types/hackathon.ts) ──────────────────────────
// Defined here directly to avoid cross-boundary import issues with ts-node
export interface Round {
  /** Display name for this round (e.g. "Ideation", "Grand Finale") */
  name: string;
  /** Whether this round is conducted online or offline */
  type: 'online' | 'offline';
  /** ISO 8601 UTC string */
  start_date: string;
  /** ISO 8601 UTC string */
  end_date: string;
  /** Physical location (for offline rounds) */
  location?: string;
}

// ─── Source site ──────────────────────────────────────────────────────────────
export type SourceSite =
  | 'unstop'
  | 'devpost'
  | 'hackculture';

// ─── Main scraper output type ─────────────────────────────────────────────────
/**
 * The shape every scraper must return.
 * registration_end is REQUIRED — scrapers must provide it or skip the hackathon.
 */
export interface ScrapedHackathon {
  title: string;
  source_site: SourceSite;
  source_url: string;
  mode?: 'online' | 'offline' | 'hybrid';
  prize_pool?: string;
  team_size?: string;
  banner_url?: string;
  tags?: string[];
  ai_summary?: string;

  // ISO 8601 UTC strings
  registration_start?: string;
  registration_end: string; // REQUIRED

  rounds?: Round[];

  venue_name?: string;
  venue_city?: string;
  venue_state?: string;
}

/** Every scraper module must export a function matching this signature */
export type ScraperFn = () => Promise<ScrapedHackathon[]>;

// ─── Run statistics ───────────────────────────────────────────────────────────
export interface RunStats {
  source: SourceSite;
  fetched: number;
  upserted: number;
  skipped: number;
  errors: string[];
}

export interface OrchestratorSummary {
  startedAt: string;
  finishedAt: string;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalSkipped: number;
  totalExpired: number;
  perSource: RunStats[];
}
