/**
 * scripts/scraper/utils/logger.ts
 *
 * Structured console logger for scraper runs.
 * Prefixes every message with timestamp + source label.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export class ScraperLogger {
  constructor(private readonly source: string) {}

  private fmt(level: LogLevel, msg: string, data?: unknown): string {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase().padEnd(7)}] [${this.source}] ${msg}`;
    return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
  }

  info(msg: string, data?: unknown)    { console.info(this.fmt('info', msg, data)); }
  warn(msg: string, data?: unknown)    { console.warn(this.fmt('warn', msg, data)); }
  error(msg: string, data?: unknown)   { console.error(this.fmt('error', msg, data)); }
  debug(msg: string, data?: unknown)   { console.debug(this.fmt('debug', msg, data)); }
  success(msg: string, data?: unknown) { console.info(this.fmt('success', msg, data)); }

  /** Log a date parse failure consistently across all scrapers. */
  dateParseFailure(field: string, raw: string | null | undefined, url: string) {
    this.error(`Date parse failure — field="${field}" raw=${JSON.stringify(raw)} url="${url}"`);
  }

  /** Log a skipped hackathon with reason. */
  skipped(url: string, reason: string) {
    this.warn(`Skipped "${url}" — ${reason}`);
  }
}

/** Create a logger pre-bound to a source. */
export function makeLogger(source: string): ScraperLogger {
  return new ScraperLogger(source);
}
