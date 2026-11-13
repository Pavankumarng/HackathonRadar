-- Keep persisted source and mode values aligned with the ingestion contract.
do $constraints$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'hackathons_source_site_allowed'
      and conrelid = 'public.hackathons'::pg_catalog.regclass
  ) then
    alter table public.hackathons
      add constraint hackathons_source_site_allowed
      check (source_site in ('unstop', 'devpost', 'hackculture')) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'hackathons_mode_allowed'
      and conrelid = 'public.hackathons'::pg_catalog.regclass
  ) then
    alter table public.hackathons
      add constraint hackathons_mode_allowed
      check (mode is null or mode in ('online', 'offline', 'hybrid')) not valid;
  end if;
end
$constraints$;

alter table public.hackathons validate constraint hackathons_source_site_allowed;
alter table public.hackathons validate constraint hackathons_mode_allowed;
