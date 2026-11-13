-- Public users may discover hackathons but cannot mutate ingestion data.
revoke insert, update, delete, truncate, references, trigger
  on table public.hackathons
  from public, anon, authenticated;

grant select on table public.hackathons to anon, authenticated;
grant all on table public.hackathons to service_role;

-- Trigger functions are invoked by PostgreSQL triggers, not by API clients.
revoke all on function public.update_updated_at_column()
  from public, anon, authenticated;
