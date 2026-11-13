-- ============================================================
-- HackathonRadar — Supabase schema reference
-- Current schema is also versioned in supabase/migrations/.
-- Run the migrations in order on a fresh project.
-- ============================================================

create table if not exists public.hackathons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_site text not null, -- unstop | devpost | hackculture
  source_url text not null unique,
  mode text, -- online | offline | hybrid
  prize_pool text,
  team_size text,
  banner_url text,
  tags text[],
  ai_summary text,
  registration_start timestamptz,
  registration_end timestamptz not null,
  rounds jsonb not null default '[]'::jsonb,
  venue_name text,
  venue_city text,
  venue_state text,
  scraped_at timestamptz default pg_catalog.now(),
  updated_at timestamptz default pg_catalog.now(),
  is_active boolean default true
);

create index if not exists idx_hackathons_registration_end
  on public.hackathons (registration_end);
create index if not exists idx_hackathons_source_site
  on public.hackathons (source_site);
create index if not exists idx_hackathons_is_active
  on public.hackathons (is_active);
create index if not exists idx_hackathons_mode
  on public.hackathons (mode);

alter table public.hackathons enable row level security;

do $policy$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
     where schemaname = 'public'
       and tablename = 'hackathons'
       and policyname = 'Allow public read access'
  ) then
    create policy "Allow public read access"
      on public.hackathons
      for select
      using (true);
  end if;
end
$policy$;

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  results jsonb not null default '{}'::jsonb,
  errors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_scrape_runs_started_at
  on public.scrape_runs (started_at desc);

-- Telemetry is private: the scraper uses SUPABASE_SERVICE_ROLE_KEY.
alter table public.scrape_runs enable row level security;
revoke all on table public.scrape_runs from public, anon, authenticated;
grant all on table public.scrape_runs to service_role;

create or replace function public.expire_old_hackathons_count()
returns integer
language sql
set search_path = pg_catalog, public
as $function$
  with expired as (
    update public.hackathons
       set is_active = false
     where registration_end < pg_catalog.now()
       and is_active is true
    returning 1
  )
  select count(*)::integer from expired;
$function$;

create or replace function public.expire_old_hackathons()
returns void
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  perform public.expire_old_hackathons_count();
end;
$function$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

revoke all on function public.expire_old_hackathons() from public, anon, authenticated;
revoke all on function public.expire_old_hackathons_count() from public, anon, authenticated;
grant execute on function public.expire_old_hackathons() to service_role;
grant execute on function public.expire_old_hackathons_count() to service_role;

create or replace trigger set_hackathons_updated_at
before update on public.hackathons
for each row
execute function public.update_updated_at_column();
