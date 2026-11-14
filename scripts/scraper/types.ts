/**
 * Types used by the scraper pipeline.
 */

export interface Round {
  name: string;
  type: 'online' | 'offline';
  start_date: string;
  end_date: string;
  location?: string;
}

export type SourceSite = 'unstop' | 'devpost' | 'hackculture';
export type HackathonMode = 'online' | 'offline' | 'hybrid';

export interface ScrapedHackathon {
  title: string;
  source_site: SourceSite;
  source_url: string;
  mode?: HackathonMode;
  prize_pool?: string;
  team_size?: string;
  banner_url?: string;
  tags?: string[];
  ai_summary?: string;
  registration_start?: string;
  registration_end: string;
  rounds?: Round[];
  venue_name?: string;
  venue_city?: string;
  venue_state?: string;
}

/**
 * A complete source snapshot allows the orchestrator to reconcile old rows
 * against the source's current open/upcoming listing feed. An incomplete
 * snapshot must never deactivate anything.
 */
export interface ScraperBatch {
  records: ScrapedHackathon[];
  observedCount: number;
  observedUrls: string[];
  pagesFetched: number;
  snapshotComplete: boolean;
  completionReason: string;
  advertisedTotal?: number;
}

export type ScraperFn = () => Promise<ScraperBatch>;

export interface RunStats {
  source: SourceSite;
  fetched: number;
  observed: number;
  pagesFetched: number;
  snapshotComplete: boolean;
  upserted: number;
  inserted: number;
  updated: number;
  deactivated: number;
  skipped: number;
  errors: string[];
}

export interface OrchestratorSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalUpserted: number;
  totalDeactivated: number;
  totalSkipped: number;
  totalExpired: number;
  perSource: RunStats[];
}
