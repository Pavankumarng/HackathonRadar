/**
 * Cross-platform entrypoint for a no-write scraper validation run.
 * Set the flag before loading the orchestrator because it is read at module load.
 */
process.env.SCRAPE_DRY_RUN = 'true';
require('./index');
