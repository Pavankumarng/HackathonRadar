-- ============================================================
-- HackRadar — Supabase SQL Schema (Secure Configuration)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ------------------------------------------------------------
-- 1. Main hackathons table
-- ------------------------------------------------------------
CREATE TABLE hackathons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_site TEXT NOT NULL,        -- 'unstop' | 'devfolio' | 'hackerearth' | 'devpost' | 'hackculture'
  source_url TEXT NOT NULL UNIQUE,
  mode TEXT,                        -- 'online' | 'offline' | 'hybrid'
  prize_pool TEXT,
  team_size TEXT,
  banner_url TEXT,
  tags TEXT[],
  ai_summary TEXT,                  -- Gemini summary, cached here, updated every 12h

  -- Registration window
  registration_start TIMESTAMPTZ,
  registration_end TIMESTAMPTZ NOT NULL,  -- used for auto-expiry

  -- Rounds (JSONB array for flexibility)
  rounds JSONB DEFAULT '[]',

  -- Venue (for offline/hybrid)
  venue_name TEXT,
  venue_city TEXT,
  venue_state TEXT,

  -- Meta
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- ------------------------------------------------------------
-- 2. Indexes for fast queries
-- ------------------------------------------------------------
CREATE INDEX idx_hackathons_registration_end ON hackathons(registration_end);
CREATE INDEX idx_hackathons_source_site      ON hackathons(source_site);
CREATE INDEX idx_hackathons_is_active        ON hackathons(is_active);
CREATE INDEX idx_hackathons_mode             ON hackathons(mode);

-- ------------------------------------------------------------
-- 3. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------
ALTER TABLE hackathons ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active hackathons
CREATE POLICY "Allow public read access"
ON hackathons
FOR SELECT
USING (true);

-- ------------------------------------------------------------
-- 4. Auto-expire function
-- Marks hackathons as inactive when their registration has closed.
-- Schedule this via: Supabase Dashboard > Database > Scheduled Functions
--   Function : expire_old_hackathons
--   Schedule : 0 * * * *  (every hour)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_old_hackathons()
RETURNS void AS $$
  UPDATE hackathons
  SET is_active = false
  WHERE registration_end < NOW() AND is_active = true;
$$ LANGUAGE SQL;

-- ------------------------------------------------------------
-- 5. Auto-update updated_at trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_hackathons_updated_at
BEFORE UPDATE ON hackathons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 6. Scraper Runs Logs
-- ------------------------------------------------------------
CREATE TABLE scrape_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  results JSONB NOT NULL,    -- e.g. {"unstop": 10, "devpost": 5}
  errors JSONB DEFAULT '{}'  -- e.g. {"hackculture": "timeout error"}
);

-- Note: No RLS policy needed for scrape_runs since it's only accessed via service_role by the scraper script.

