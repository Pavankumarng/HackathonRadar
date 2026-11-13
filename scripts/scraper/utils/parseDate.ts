import { isValid, parse, parseISO } from 'date-fns';

const FULL_DATE_FORMATS = [
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mmXXX",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd HH:mm:ss",
  'yyyy-MM-dd',
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
];

const MONTH_DATE_PATTERN =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi;

function parseWithFormats(value: string): Date | null {
  const iso = parseISO(value);
  if (isValid(iso)) return iso;

  const referenceDate = new Date(Date.UTC(2000, 0, 1));
  for (const format of FULL_DATE_FORMATS) {
    const parsed = parse(value, format, referenceDate);
    if (isValid(parsed)) return parsed;
  }
  return null;
}

export function parseHackathonDate(raw: string | null | undefined): Date | null {
  if (!raw || !raw.trim()) return null;

  const cleaned = raw
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ');

  try {
    const parsed = parseWithFormats(cleaned);
    return parsed && isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function explicitYear(value: string): number | null {
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function parseMonthDayToken(token: string, year: number): Date | null {
  const cleaned = token
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const candidates = [
    cleaned + ', ' + year,
    cleaned + ' ' + year,
  ];
  for (const candidate of candidates) {
    const parsed = parseHackathonDate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

export interface ParsedDateRange {
  start: string | null;
  end: string;
}

/**
 * Parse a date or a month-name date range without inventing a deadline.
 * A year must be present on at least one endpoint.
 */
export function parseDateRange(raw: string | null | undefined): ParsedDateRange | null {
  if (!raw || !raw.trim()) return null;

  const text = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const matches = Array.from(text.matchAll(MONTH_DATE_PATTERN));

  if (matches.length >= 2) {
    const first = matches[0][0];
    const second = matches[1][0];
    const firstYear = explicitYear(first);
    const secondYear = explicitYear(second);
    if (!firstYear && !secondYear) return null;

    const secondMonth = new Date(Date.parse(second.replace(/(\d+)(st|nd|rd|th)/gi, '$1') + (secondYear ? '' : ', ' + firstYear))).getMonth();
    const firstMonth = new Date(Date.parse(first.replace(/(\d+)(st|nd|rd|th)/gi, '$1') + (firstYear ? '' : ', ' + secondYear))).getMonth();

    const startYear = firstYear ?? (secondYear && firstMonth > secondMonth ? secondYear - 1 : secondYear);
    const endYear = secondYear ?? (firstYear && secondMonth < firstMonth ? firstYear + 1 : firstYear);
    if (!startYear || !endYear) return null;

    const startDate = parseMonthDayToken(first, startYear);
    const endDate = parseMonthDayToken(second, endYear);
    if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) return null;

    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  const single = matches[0]?.[0];
  if (single) {
    const year = explicitYear(single);
    if (!year) return null;
    const deadline = parseMonthDayToken(single, year);
    return deadline ? { start: null, end: deadline.toISOString() } : null;
  }

  const direct = parseHackathonDate(text);
  if (direct && explicitYear(text)) {
    return { start: null, end: direct.toISOString() };
  }

  return null;
}

export function toISO(raw: string | null | undefined): string | null {
  const parsed = parseHackathonDate(raw);
  return parsed ? parsed.toISOString() : null;
}
