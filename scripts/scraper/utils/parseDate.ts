import { isValid, parse, parseISO } from 'date-fns';

const IST_OFFSET_MINUTES = 330;
const FORMATS = [
  'yyyy-MM-dd',
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mmXXX",
  "yyyy-MM-dd'T'HH:mm:ss",
  'yyyy-MM-dd HH:mm:ss',
  'MMM d, yyyy',
  'MMMM d, yyyy',
  'MMM d yyyy',
  'MMMM d yyyy',
  'd MMM yyyy',
  'd MMMM yyyy',
  'dd MMM yyyy',
  'dd MMMM yyyy',
  'dd/MM/yyyy',
  'd/M/yyyy',
  'MM/dd/yyyy',
  'M/d/yyyy',
  'dd-MM-yyyy',
  'MMM d, yyyy h:mm a',
  'MMMM d, yyyy h:mm a',
  'd MMM yyyy, h:mm a',
] as const;

const MONTH_DATE_PATTERN =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi;

interface ParsedRawDate {
  date: Date;
  explicitTimezone: boolean;
  dateOnly: boolean;
}

function parseRawDate(raw: string): ParsedRawDate | null {
  const cleaned = raw
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ');

  const explicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(cleaned);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ||
    /^(?:\w{3,9})\.?\s+\d{1,2},?\s+\d{4}$/.test(cleaned) ||
    /^\d{1,2}\s+\w{3,9}\.?\s+\d{4}$/.test(cleaned) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(cleaned);

  const iso = parseISO(cleaned);
  if (isValid(iso)) return { date: iso, explicitTimezone, dateOnly };

  const referenceDate = new Date(Date.UTC(2000, 0, 1));
  for (const format of FORMATS) {
    const value = parse(cleaned, format, referenceDate);
    if (isValid(value)) return { date: value, explicitTimezone: false, dateOnly: true };
  }
  return null;
}

function toIstUtc(date: Date, endOfDay = false): Date {
  const hours = endOfDay ? 23 : date.getHours();
  const minutes = endOfDay ? 59 : date.getMinutes();
  const seconds = endOfDay ? 59 : date.getSeconds();
  const milliseconds = endOfDay ? 999 : date.getMilliseconds();
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds, milliseconds) -
      IST_OFFSET_MINUTES * 60_000
  );
}

function hasYear(value: string): number | null {
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function monthDayDate(token: string, year: number, endOfDay: boolean): string | null {
  const normalized = token.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1').trim();
  const raw = /,\s*20\d{2}\b/.test(normalized)
    ? normalized
    : normalized + ', ' + year;
  const parsed = parseRawDate(raw);
  if (!parsed) return null;
  return toIstUtc(parsed.date, endOfDay).toISOString();
}

export function parseHackathonDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const parsed = parseRawDate(raw);
  if (!parsed) return null;
  if (parsed.explicitTimezone) return parsed.date;
  return toIstUtc(parsed.date);
}

/** Parse a deadline; date-only values expire at 23:59:59.999 IST. */
export function toDeadlineISO(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const parsed = parseRawDate(raw);
  if (!parsed) return null;
  if (parsed.explicitTimezone) return parsed.date.toISOString();
  return toIstUtc(parsed.date, parsed.dateOnly).toISOString();
}

export interface ParsedDateRange {
  start: string | null;
  end: string;
}

/**
 * Parse platform date ranges such as "Nov 10 - Dec 15, 2026".
 * A year must be present on at least one endpoint; no default deadline is fabricated.
 */
export function parseDateRange(raw: string | null | undefined): ParsedDateRange | null {
  if (!raw?.trim()) return null;
  const text = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const matches = Array.from(text.matchAll(MONTH_DATE_PATTERN));

  if (matches.length >= 2) {
    const first = matches[0][0];
    const second = matches[1][0];
    const firstYear = hasYear(first);
    const secondYear = hasYear(second);
    if (!firstYear && !secondYear) return null;

    const firstMonth = parseRawDate(firstYear ? first : first + ', ' + secondYear)?.date.getMonth();
    const secondMonth = parseRawDate(secondYear ? second : second + ', ' + firstYear)?.date.getMonth();
    if (firstMonth === undefined || secondMonth === undefined) return null;

    const startYear = firstYear ?? (secondYear && firstMonth > secondMonth ? secondYear - 1 : secondYear);
    const endYear = secondYear ?? (firstYear && secondMonth < firstMonth ? firstYear + 1 : firstYear);
    if (!startYear || !endYear) return null;

    const start = monthDayDate(first, startYear, false);
    const end = monthDayDate(second, endYear, true);
    if (!start || !end || Date.parse(end) < Date.parse(start)) return null;
    return { start, end };
  }

  const single = matches[0]?.[0];
  if (single) {
    const year = hasYear(single);
    if (!year) return null;
    const end = monthDayDate(single, year, true);
    return end ? { start: null, end } : null;
  }

  const deadline = toDeadlineISO(text);
  return deadline && hasYear(text) ? { start: null, end: deadline } : null;
}

export function toISO(raw: string | null | undefined): string | null {
  const parsed = parseHackathonDate(raw);
  return parsed ? parsed.toISOString() : null;
}
