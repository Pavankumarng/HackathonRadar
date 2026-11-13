-- Adds trusted scraper-run telemetry and hardens database functions.
-- scrape_runs is intentionally not readable by anon/authenticated users.

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
