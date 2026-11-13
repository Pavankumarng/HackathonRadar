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

export type ScraperFn = () => Promise<ScrapedHackathon[]>;

export interface RunStats {
  source: SourceSite;
  fetched: number;
  upserted: number;
  inserted: number;
  updated: number;
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
  totalSkipped: number;
  totalExpired: number;
  perSource: RunStats[];
}
