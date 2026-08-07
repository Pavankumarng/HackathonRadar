/**
 * src/types/hackathon.ts
 *
 * TypeScript types mirroring the Supabase `hackathons` table schema.
 * Keep in sync with the SQL schema in /docs/schema.sql (or Supabase dashboard).
 */

// ---------------------------------------------------------------------------
// Round — JSONB sub-type stored inside hackathons.rounds
// ---------------------------------------------------------------------------

/** Represents one round/phase of a hackathon (stored as JSONB array). */
export interface Round {
  /** Display name for this round (e.g. "Ideation", "Prototype Submission", "Grand Finale") */
  name: string;

  /** Whether this round is conducted online or offline. */
  type: 'online' | 'offline';

  /** ISO 8601 timestamp — when this round starts. */
  start_date: string;

  /** ISO 8601 timestamp — when this round ends. */
  end_date: string;

  /**
   * Physical location for offline rounds.
   * e.g. "IIT Bombay, Mumbai"
   * Optional — only present for offline/hybrid rounds.
   */
  location?: string;
}

// ---------------------------------------------------------------------------
// Source site union — mirrors the source_site column CHECK constraint
// ---------------------------------------------------------------------------

export type SourceSite =
  | 'unstop'
  | 'devpost'
  | 'hackculture';

// ---------------------------------------------------------------------------
// Mode union — mirrors the mode column
// ---------------------------------------------------------------------------

export type HackathonMode = 'online' | 'offline' | 'hybrid';

// ---------------------------------------------------------------------------
// Hackathon — full row type matching the hackathons table
// ---------------------------------------------------------------------------

/**
 * Full hackathon record as stored in Supabase.
 * Column names exactly match the SQL schema.
 */
export interface Hackathon {
  /** UUID primary key (gen_random_uuid()) */
  id: string;

  /** Display title of the hackathon */
  title: string;

  /** Where this hackathon was scraped from */
  source_site: SourceSite;

  /** Canonical URL on the source site (UNIQUE constraint) */
  source_url: string;

  /** Format of the hackathon */
  mode: HackathonMode | null;

  /** Prize pool description, e.g. "₹5,00,000" or "$10,000 total" */
  prize_pool: string | null;

  /** Allowed team size description, e.g. "2–4 members" */
  team_size: string | null;

  /** URL to the hackathon banner/cover image */
  banner_url: string | null;

  /** Array of tags/themes, e.g. ["AI", "Web3", "HealthTech"] */
  tags: string[] | null;

  /**
   * AI-generated summary of the hackathon (via Gemini).
   * Cached in DB and refreshed every 12 hours by the cron job.
   */
  ai_summary: string | null;

  /** ISO 8601 timestamp — when registration opens */
  registration_start: string | null;

  /**
   * ISO 8601 timestamp — when registration closes.
   * NOT NULL; used by the auto-expire function and RLS policy.
   */
  registration_end: string;

  /**
   * JSONB array of Round objects.
   * Defaults to [].
   */
  rounds: Round[];

  // --- Venue (offline / hybrid) ---

  /** Name of the venue, e.g. "NSIT Delhi" */
  venue_name: string | null;

  /** City where the event is held */
  venue_city: string | null;

  /** State / province where the event is held */
  venue_state: string | null;

  // --- Meta ---

  /** When this record was first scraped (set to NOW() on insert) */
  scraped_at: string;

  /** When this record was last updated */
  updated_at: string;

  /**
   * Whether this hackathon is still active.
   * Set to false by the expire_old_hackathons() scheduled function
   * when registration_end < NOW().
   */
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Convenience / derived types
// ---------------------------------------------------------------------------

/**
 * Minimal shape for list/card views — omits heavy JSONB and AI fields.
 * Use this for the main hackathon feed to keep API payloads small.
 */
export type HackathonSummary = Pick<
  Hackathon,
  | 'id'
  | 'title'
  | 'source_site'
  | 'source_url'
  | 'mode'
  | 'prize_pool'
  | 'team_size'
  | 'banner_url'
  | 'tags'
  | 'registration_start'
  | 'registration_end'
  | 'venue_city'
  | 'venue_state'
  | 'is_active'
>;

/**
 * Payload shape for inserting a new hackathon via the scraper/API.
 * Omits server-generated fields (id, scraped_at, updated_at).
 */
export type HackathonInsert = Omit<Hackathon, 'id' | 'scraped_at' | 'updated_at'> & {
  scraped_at?: string;
  updated_at?: string;
};

/**
 * Payload shape for patching an existing hackathon.
 * All fields are optional except the primary key is supplied externally.
 */
export type HackathonUpdate = Partial<Omit<Hackathon, 'id'>>;

// ---------------------------------------------------------------------------
// Filter / query params (for the /api/hackathons endpoint)
// ---------------------------------------------------------------------------

export interface HackathonFilters {
  mode?: HackathonMode;
  source_site?: SourceSite;
  tags?: string[];
  search?: string;
  /** 'live' = registration open now; 'upcoming' = starts in the future; 'ended' = past */
  status?: 'live' | 'upcoming' | 'ended';
  page?: number;
  limit?: number;
  sort?: 'deadline_asc' | 'deadline_desc' | 'newest';
}
