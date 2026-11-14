import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDateRange, toDeadlineISO } from './parseDate';
import { normalizeUnstopEventUrl } from '../../../src/lib/urls/unstop';
import { extractUnstopRegistrationDeadline } from './unstopDeadline';
import { getStaleSourceUrls } from './reconcile';

test('parses a full month-to-month listing range into IST boundaries', () => {
  const result = parseDateRange('Oct 30 - Dec 04, 2026');
  assert.ok(result);
  assert.equal(result.start, '2026-10-29T18:30:00.000Z');
  assert.equal(result.end, '2026-12-04T18:29:59.999Z');
});

test('parses Devpost abbreviated same-month ranges', () => {
  const result = parseDateRange('Nov 11 - 30, 2026');
  assert.ok(result);
  assert.equal(result.start, '2026-11-10T18:30:00.000Z');
  assert.equal(result.end, '2026-11-30T18:29:59.999Z');
});

test('handles ranges that cross a calendar year', () => {
  const result = parseDateRange('Dec 29 - Jan 05, 2027');
  assert.ok(result);
  assert.equal(result.start, '2026-12-28T18:30:00.000Z');
  assert.equal(result.end, '2027-01-05T18:29:59.999Z');
});

test('does not invent a year for a yearless date range', () => {
  assert.equal(parseDateRange('Nov 11 - Dec 08'), null);
  assert.equal(parseDateRange('Nov 11 - 30'), null);
});

test('treats date-only deadlines as end of day in IST', () => {
  assert.equal(toDeadlineISO('2026-11-14'), '2026-11-14T18:29:59.999Z');
});

test('preserves explicit timezone offsets', () => {
  assert.equal(
    toDeadlineISO('2026-11-14T23:59:59+05:30'),
    '2026-11-14T18:29:59.000Z',
  );
});

test('rejects impossible calendar dates', () => {
  assert.equal(parseDateRange('Feb 30 - Mar 05, 2027'), null);
});

const unstopSlug = 'data-sprint-20-anveshan-nie-1807080';
const canonicalUnstopUrl = `https://unstop.com/hackathons/${unstopSlug}`;

test('normalizes duplicated Unstop collection path from scraper payloads', () => {
  assert.equal(
    normalizeUnstopEventUrl(`hackathons/hackathons/${unstopSlug}`),
    canonicalUnstopUrl,
  );
});

test('normalizes repeated Unstop path prefixes regardless of count', () => {
  assert.equal(
    normalizeUnstopEventUrl(`/hackathons/hackathons/hackathons/${unstopSlug}`),
    canonicalUnstopUrl,
  );
});

test('normalizes absolute and www Unstop links to canonical HTTPS URLs', () => {
  assert.equal(
    normalizeUnstopEventUrl(`http://www.unstop.com/hackathons/hackathons/${unstopSlug}?ref=home#top`),
    canonicalUnstopUrl,
  );
});

test('preserves already canonical Unstop event detail URLs', () => {
  assert.equal(normalizeUnstopEventUrl(canonicalUnstopUrl), canonicalUnstopUrl);
});

test('adds the event path to an Unstop opportunity slug', () => {
  assert.equal(normalizeUnstopEventUrl(unstopSlug), canonicalUnstopUrl);
});

test('rejects Unstop home, collection and API URLs', () => {
  assert.equal(normalizeUnstopEventUrl('https://unstop.com/'), null);
  assert.equal(normalizeUnstopEventUrl('https://unstop.com/hackathons'), null);
  assert.equal(normalizeUnstopEventUrl('https://unstop.com/api/public/opportunity/123'), null);
});

test('rejects off-domain and unsafe Unstop URLs', () => {
  assert.equal(normalizeUnstopEventUrl('https://example.com/hackathons/event'), null);
  assert.equal(normalizeUnstopEventUrl('javascript:alert(1)'), null);
});

test('never treats an Unstop event or round end date as a registration deadline', () => {
  assert.equal(
    extractUnstopRegistrationDeadline({
      end_date: '2026-11-14T10:01:00+05:30',
      event_end_date: '2026-11-14T10:01:00+05:30',
      deadline: '2026-11-14T10:01:00+05:30',
      rounds: [{ end_date: '2026-11-14T10:01:00+05:30' }],
    }),
    undefined,
  );
});

test('prefers Unstop registration requirement deadline over event end date', () => {
  assert.equal(
    extractUnstopRegistrationDeadline({
      end_date: '2026-11-14T10:01:00+05:30',
      regnRequirements: {
        end_regn_dt: '2026-10-26T23:59:00+05:30',
      },
    }),
    '2026-10-26T23:59:00+05:30',
  );
});

test('supports explicit registration_end aliases without falling back to event end', () => {
  assert.equal(
    extractUnstopRegistrationDeadline({
      registration_end: '2026-10-26T23:59:00+05:30',
      end_date: '2026-11-14T10:01:00+05:30',
    }),
    '2026-10-26T23:59:00+05:30',
  );
});

test('reconciles only URLs missing from a complete active snapshot', () => {
  const existing = ['unstop/a', 'unstop/b', 'unstop/c'];
  const current = new Set(['unstop/a', 'unstop/c']);
  assert.deepEqual(getStaleSourceUrls(existing, current), ['unstop/b']);
});

test('does not mark any listing stale when all existing URLs are present', () => {
  const existing = ['devpost/a', 'devpost/b'];
  const current = new Set(existing);
  assert.deepEqual(getStaleSourceUrls(existing, current), []);
});

test('an empty current snapshot identifies all existing rows, but the caller must require snapshotComplete', () => {
  const existing = ['unstop/a', 'unstop/b'];
  assert.deepEqual(getStaleSourceUrls(existing, new Set()), existing);
});
