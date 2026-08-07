/**
 * scripts/scraper/utils/dateParser.ts
 *
 * Central date-parsing utility for all scrapers.
 * Accuracy of dates is the #1 priority in HackRadar.
 *
 * Rules:
 *  - Tries multiple format patterns in order.
 *  - Ambiguous timezone → assume IST (UTC+5:30), store as UTC.
 *  - Month-only dates → last day of that month.
 *  - Unparseable → returns null and LOGS the raw string (never silent).
 */

import {
  parse,
  isValid,
  endOfMonth,
  parseISO,
  formatISO,
  addMinutes,
} from 'date-fns';

// ─── IST offset ────────────────────────────────────────────────────────────
const IST_OFFSET_MINUTES = 5 * 60 + 30; // 330 minutes ahead of UTC

/** Convert a local IST Date object to a UTC ISO string. */
function istToUtcIso(d: Date): string {
  // Shift the date back by IST offset to get UTC
  const utc = addMinutes(d, -IST_OFFSET_MINUTES);
  return formatISO(utc);
}

// ─── Format catalogue ───────────────────────────────────────────────────────

/** Full-date formats tried in priority order. */
const FULL_DATE_FORMATS = [
  // ISO first (already unambiguous)
  'yyyy-MM-dd',
  "yyyy-MM-dd'T'HH:mm:ssxxx",
  "yyyy-MM-dd'T'HH:mmxxx",
  // Common display formats
  'MMM d, yyyy',       // Jan 5, 2025
  'MMM d,yyyy',        // Jan 5,2025 (no space)
  'MMMM d, yyyy',      // January 5, 2025
  'MMMM d,yyyy',
  'd MMM yyyy',        // 5 Jan 2025
  'd MMMM yyyy',       // 5 January 2025
  'dd/MM/yyyy',        // 05/01/2025 (DD/MM)
  'MM/dd/yyyy',        // 01/05/2025 (MM/DD)
  'dd-MM-yyyy',
  'dd MMM yyyy',       // 05 Jan 2025
  'dd MMMM yyyy',
  'MMM dd, yyyy',      // Jan 05, 2025
  'MMMM dd, yyyy',
  'dd MMM, yyyy',      // 05 Jan, 2025
  'd/M/yyyy',
  'M/d/yyyy',
  // With time
  'MMM d, yyyy h:mm a',
  'MMM d, yyyy HH:mm',
  'MMMM d, yyyy h:mm a',
  'd MMM yyyy, h:mm a',
  'd MMM yyyy HH:mm',
];

/** Month-year-only formats → we'll snap to end-of-month. */
const MONTH_YEAR_FORMATS = [
  'MMM yyyy',   // Jan 2025
  'MMMM yyyy',  // January 2025
  'MM/yyyy',    // 01/2025
  'yyyy-MM',    // 2025-01
];

// ─── Core parser ────────────────────────────────────────────────────────────

/**
 * Parse a raw date string scraped from a hackathon platform.
 *
 * @param raw      The raw date string from the DOM / JSON-LD / API.
 * @param context  Human-readable label for error logging (e.g. "Devfolio: registration_end").
 * @returns        ISO 8601 UTC string, or null if unparseable.
 */
export function parseHackathonDate(
  raw: string | null | undefined,
  context: string
): string | null {
  if (!raw || raw.trim() === '') {
    console.warn(`[dateParser] EMPTY date for "${context}"`);
    return null;
  }

  const cleaned = raw.trim()
    // Normalise typographic apostrophes / spaces
    .replace(/\u00a0/g, ' ')
    // Remove ordinal suffixes: "15th" → "15", "1st" → "1"
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ');

  // 1. Try standard ISO parse first (handles timezone info correctly)
  try {
    const iso = parseISO(cleaned);
    if (isValid(iso)) {
      // If the raw string had an explicit timezone, trust it
      if (/[Zz]|[+-]\d{2}:?\d{2}/.test(cleaned)) {
        return formatISO(iso);
      }
      // No timezone → assume IST
      return istToUtcIso(iso);
    }
  } catch {
    // fall through
  }

  // 2. Try each full-date format
  const referenceDate = new Date();
  for (const fmt of FULL_DATE_FORMATS) {
    try {
      const d = parse(cleaned, fmt, referenceDate);
      if (isValid(d)) {
        return istToUtcIso(d);
      }
    } catch {
      // try next
    }
  }

  // 3. Try month-year-only formats → snap to last day of month
  for (const fmt of MONTH_YEAR_FORMATS) {
    try {
      const d = parse(cleaned, fmt, referenceDate);
      if (isValid(d)) {
        const eom = endOfMonth(d);
        console.info(
          `[dateParser] Month-only date for "${context}": "${raw}" → end-of-month ${formatISO(eom)}`
        );
        return istToUtcIso(eom);
      }
    } catch {
      // try next
    }
  }

  // 4. Give up — log and return null
  console.error(
    `[dateParser] UNPARSEABLE date for "${context}": "${raw}" (cleaned: "${cleaned}")`
  );
  return null;
}

/**
 * Extract the first date-like substring from a block of text
 * and parse it.  Useful when scraping a sentence like:
 *   "Registration closes on January 15, 2025 at 11:59 PM IST"
 */
export function extractAndParseDate(
  text: string | null | undefined,
  context: string
): string | null {
  if (!text) return null;

  // Common date patterns to look for inside running text
  const patterns = [
    // ISO
    /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:[Zz]|[+-]\d{2}:?\d{2})?)?/,
    // "January 15, 2025" / "Jan 15, 2025"
    /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i,
    // "15 January 2025" / "15 Jan 2025"
    /\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}/i,
    // dd/MM/yyyy or MM/dd/yyyy
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseHackathonDate(match[0], context);
    }
  }

  return null;
}

/**
 * Convenience: parse and assert non-null.
 * Throws if the date cannot be parsed (use in contexts where we'd skip the record).
 */
export function parseRequiredDate(raw: string | null | undefined, context: string): string {
  const result = parseHackathonDate(raw, context);
  if (!result) {
    throw new Error(`Required date unparseable for "${context}": ${JSON.stringify(raw)}`);
  }
  return result;
}
