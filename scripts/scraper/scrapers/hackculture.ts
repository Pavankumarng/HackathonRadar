/**
 * HackCulture ingestion is intentionally paused.
 *
 * The current HackCulture Terms & Conditions prohibit scraping, reverse
 * engineering, and using the platform to build competing services:
 * https://hackculture.io/legal/terms-and-conditions
 *
 * Do not re-enable automated collection until HackathonRadar has written
 * permission or an official API/integration agreement from HackCulture.
 * Historical HackCulture records remain available for display in the UI.
 */
import type { ScrapedHackathon } from '../types';
import { makeLogger } from '../utils/logger';

const logger = makeLogger('hackculture');

export async function scrapeHackCulture(): Promise<ScrapedHackathon[]> {
  logger.warn(
    'Automated collection is disabled pending an official API or written permission from HackCulture. Historical records are retained.',
  );
  return [];
}
