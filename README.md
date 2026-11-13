<div align="center">

# 📡 HackathonRadar

### *Every hackathon. One place.*

A discovery dashboard for active hackathons from **Unstop and Devpost**. Listings are collected by scheduled GitHub Actions, stored in Supabase, and displayed in a searchable Next.js interface.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://hackathon-radar-alpha.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Scheduled-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)

</div>

---

## Features

- Aggregated hackathon listings from Unstop and Devpost.
- Historical HackCulture records remain viewable, but automated collection is paused pending an approved API or written permission.
- Filters for event mode, source, keyword, and registration deadline.
- Server-rendered, paginated listings backed by Supabase.
- Registration countdowns, available event metadata, tags, and direct links to the source listing.
- Scheduled scraper execution every 12 hours, with a manual workflow trigger.
- Run telemetry in a private `scrape_runs` table.
- Deadline validation: events without a verifiable deadline are skipped rather than assigned an invented date.

## Architecture

```text
Unstop ─────┐
Devpost ────┼──> GitHub Actions scraper ──> Supabase PostgreSQL
                         (historical only)     │
                                                ▼
                                      Next.js App Router
                                                │
                                                ▼
                                      HackathonRadar UI
```

## Requirements

- Node.js 22
- npm
- A Supabase project
- A Supabase service-role key for the scraper only
- Optional Upstash Redis credentials for API rate limiting

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

   # Optional API rate limiting
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```

   Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_*` variable or commit it to Git.

3. Start the application:

   ```bash
   npm run dev
   ```

## Scraper commands

| Command | Purpose |
|---|---|
| `npm run scrape` | Run all configured scrapers and persist valid records |
| `npm run scrape:dry` | Validate source data without database writes |
| `npm run scrape:typecheck` | Typecheck scraper modules |
| `npm run test:scraper` | Run deadline parser regression tests |
| `npm run typecheck` | Typecheck the application |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |

The scraper accepts explicit registration deadline fields only. It does not infer a registration deadline from an unrelated event end date. Source sites can change their public page/API structures, so a zero-result scrape should be checked in the workflow logs before assuming that no opportunities are available.

## GitHub Actions configuration

The scheduled workflow needs these repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is only used by the server-side scraper workflow. It is not used by the browser application.

The quality workflow runs lint, application and scraper typechecks, deadline tests, and a production build for pull requests and pushes to the main/quality branches.

## Database

The schema reference is in [`docs/schema.sql`](docs/schema.sql). Versioned database migrations live in [`supabase/migrations/`](supabase/migrations/).

- `hackathons` stores the public event listings.
- `scrape_runs` stores private execution summaries and errors. It has RLS enabled and is restricted to the service role.

Expired listings are marked inactive; existing records are not automatically deleted.

## Current source coverage

The scheduled scraper currently collects from **Unstop and Devpost**. HackCulture records already stored in the database remain visible and filterable, but its automated scraper is disabled. HackCulture's published [Terms & Conditions](https://hackculture.io/legal/terms-and-conditions) prohibit scraping, reverse engineering, and using the platform to build competing services. Re-enable collection only after receiving written permission or an official API/integration agreement. This is an intentional compliance restriction, not a failed background job.

---

Built to make hackathon discovery less fragmented.
