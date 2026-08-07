import { parse, parseISO, endOfMonth, isValid } from 'date-fns';

const FORMATS = [
  'yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX',  // ISO with ms
  'yyyy-MM-dd\'T\'HH:mm:ssXXX',       // ISO
  'yyyy-MM-dd\'T\'HH:mm:ss',          // ISO no tz
  'yyyy-MM-dd HH:mm:ss',              // MySQL
  'yyyy-MM-dd',                        // Date only
  'MMM d, yyyy',                       // Jan 5, 2025
  'MMMM d, yyyy',                      // January 5, 2025
  'dd MMM yyyy',                       // 05 Jan 2025
  'd MMM yyyy',                        // 5 Jan 2025
  'dd/MM/yyyy',                        // 05/01/2025
  'MM/dd/yyyy',                        // 01/05/2025
  'dd-MM-yyyy',                        // 05-01-2025
];

export function parseHackathonDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  
  // Try ISO first (fastest)
  try {
    const d = parseISO(cleaned);
    if (isValid(d) && d.getFullYear() > 2020) return d;
  } catch {}
  
  // Try each format
  for (const fmt of FORMATS) {
    try {
      const d = parse(cleaned, fmt, new Date());
      if (isValid(d) && d.getFullYear() > 2020) return d;
    } catch {}
  }
  
  // Partial: "March 2025" → end of month
  const monthYearMatch = cleaned.match(/^(\w+)\s+(\d{4})$/);
  if (monthYearMatch) {
    try {
      const d = parse(cleaned, 'MMMM yyyy', new Date());
      if (isValid(d)) return endOfMonth(d);
    } catch {}
  }
  
  console.warn(`[parseDate] Could not parse: "${raw}"`);
  return null;
}

// Returns ISO string for Supabase, or null
export function toISO(raw: string | null | undefined): string | null {
  const d = parseHackathonDate(raw);
  return d ? d.toISOString() : null;
}
