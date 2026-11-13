/**
 * Cross-platform entrypoint for a no-write scraper validation run.
 * Set the flag before dynamically loading the orchestrator because it is read
 * at module initialization.
 */
process.env.SCRAPE_DRY_RUN = 'true';

import('./index').catch((error: unknown) => {
  console.error('[dry-run] Failed to start scraper:', error);
  process.exitCode = 1;
});
