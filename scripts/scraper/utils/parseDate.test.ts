import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDateRange, toDeadlineISO } from './parseDate';

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
