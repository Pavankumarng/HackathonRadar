import { isValid, parse, parseISO } from 'date-fns';

const IST_OFFSET_MINUTES = 330;
const DATE_FORMATS = [
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

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9,
  october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

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
  const iso = parseISO(cleaned);
  if (isValid(iso)) {
    const hasTime = /(?:\d{1,2}:\d{2}\s*(?:am|pm)?|T\d{2}:)/i.test(cleaned);
    return { date: iso, explicitTimezone, dateOnly: !hasTime };
  }

  const referenceDate = new Date(Date.UTC(2000, 0, 1));
  for (const format of DATE_FORMATS) {
    const parsed = parse(cleaned, format, referenceDate);
    if (!isValid(parsed)) continue;

    const hasTime = /(?:\d{1,2}:\d{2}\s*(?:am|pm)?|T\d{2}:)/i.test(cleaned);
    return { date: parsed, explicitTimezone: false, dateOnly: !hasTime };
  }
  return null;
}

/**
 * Interpret timezone-naive source dates as India Standard Time.
 * Using the parsed calendar components avoids dependence on the server's TZ.
 */
function toIstUtc(date: Date, endOfDay = false): Date {
  const hours = endOfDay ? 23 : date.getHours();
  const minutes = endOfDay ? 59 : date.getMinutes();
  const seconds = endOfDay ? 59 : date.getSeconds();
  const milliseconds = endOfDay ? 999 : date.getMilliseconds();

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds, milliseconds) -
      IST_OFFSET_MINUTES * 60_000,
  );
}

function hasYear(value: string): number | null {
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function monthDayDate(month: number, day: number, year: number, endOfDay: boolean): string | null {
  const parsed = new Date(Date.UTC(year, month, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) return null;

  const iso = new Date(
    Date.UTC(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0) -
      IST_OFFSET_MINUTES * 60_000,
  );
  return iso.toISOString();
}

const MONTH_DAY_RANGE =
  /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\s*(?:-|–|—|to)\s*(?:([A-Za-z]{3,9})\.?\s*)?(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(20\d{2})\b/i;

function parseMonthDayRange(text: string): ParsedDateRange | null {
  const match = text.match(MONTH_DAY_RANGE);
  if (!match) return null;

  const startMonth = MONTHS[match[1].toLowerCase()];
  const endMonth = match[4] ? MONTHS[match[4].toLowerCase()] : startMonth;
  const startDay = Number(match[2]);
  const endDay = Number(match[5]);
  const firstYear = match[3] ? Number(match[3]) : null;
  const lastYear = Number(match[6]);

  if (
    startMonth === undefined || endMonth === undefined ||
    !Number.isInteger(startDay) || !Number.isInteger(endDay) ||
    startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31
  ) return null;

  const startYear = firstYear ?? (endMonth < startMonth ? lastYear - 1 : lastYear);
  const endYear = firstYear && !match[6] ? firstYear : lastYear;
  const start = monthDayDate(startMonth, startDay, startYear, false);
  const end = monthDayDate(endMonth, endDay, endYear, true);

  if (!start || !end || Date.parse(end) < Date.parse(start)) return null;
  return { start, end };
}

export function parseHackathonDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const parsed = parseRawDate(raw);
  if (!parsed) return null;
  return parsed.explicitTimezone ? parsed.date : toIstUtc(parsed.date);
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
 * Parse date ranges shown by platforms.
 * Supports "Oct 30 - Dec 04, 2026" and "Nov 11 - 30, 2026".
 * At least one explicit year is required; deadlines are never fabricated.
 */
export function parseDateRange(raw: string | null | undefined): ParsedDateRange | null {
  if (!raw?.trim()) return null;
  const text = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  const compactRange = parseMonthDayRange(text);
  if (compactRange) return compactRange;

  const monthDatePattern =
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi;
  const tokens = Array.from(text.matchAll(monthDatePattern)).map((match) => match[0]);

  if (tokens.length >= 2) {
    const first = parseRawDate(tokens[0] + (hasYear(tokens[0]) ? '' : ', ' + hasYear(tokens[1])))?.date;
    const second = parseRawDate(tokens[1])?.date;
    const firstYear = hasYear(tokens[0]);
    const secondYear = hasYear(tokens[1]);
    const trailingYear = hasYear(text);
    const resolvedStartYear = firstYear ?? secondYear ?? trailingYear;
    const resolvedEndYear = secondYear ?? trailingYear ?? firstYear;
    if (!first || !second || !resolvedStartYear || !resolvedEndYear) return null;

    const startYear = !firstYear && first.getMonth() > second.getMonth()
      ? resolvedEndYear - 1
      : resolvedStartYear;
    const endYear = !secondYear && first.getMonth() > second.getMonth()
      ? startYear + 1
      : resolvedEndYear;
    const start = monthDayDate(first.getMonth(), first.getDate(), startYear, false);
    const end = monthDayDate(second.getMonth(), second.getDate(), endYear, true);
    if (!start || !end || Date.parse(end) < Date.parse(start)) return null;
    return { start, end };
  }

  const singleYear = hasYear(text);
  const singleDate = parseRawDate(text);
  if (!singleYear || !singleDate) return null;
  return { start: null, end: toDeadlineISO(text) as string };
}

export function toISO(raw: string | null | undefined): string | null {
  const parsed = parseHackathonDate(raw);
  return parsed ? parsed.toISOString() : null;
}
