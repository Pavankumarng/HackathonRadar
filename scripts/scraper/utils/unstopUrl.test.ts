import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUnstopEventUrl } from './unstopUrl';

const slug = 'data-sprint-20-anveshan-nie-1807080';
const canonical = `https://unstop.com/hackathons/${slug}`;

test('collapses a duplicated relative Unstop collection prefix', () => {
  assert.equal(normalizeUnstopEventUrl(`hackathons/hackathons/${slug}`), canonical);
});

test('collapses a duplicated absolute Unstop collection prefix', () => {
  assert.equal(
    normalizeUnstopEventUrl(`https://unstop.com/hackathons/hackathons/${slug}`),
    canonical,
  );
});

test('preserves a valid canonical Unstop event URL', () => {
  assert.equal(normalizeUnstopEventUrl(canonical), canonical);
});

test('adds the collection prefix to a plain opportunity slug', () => {
  assert.equal(normalizeUnstopEventUrl(slug), canonical);
});

test('drops query strings and fragments from event links', () => {
  assert.equal(
    normalizeUnstopEventUrl(`${canonical}?ref=listing#details`),
    canonical,
  );
});

test('rejects Unstop homepages and non-event paths', () => {
  assert.equal(normalizeUnstopEventUrl('https://unstop.com/'), null);
  assert.equal(normalizeUnstopEventUrl('https://unstop.com/hackathons'), null);
  assert.equal(normalizeUnstopEventUrl('https://unstop.com/api/public/opportunity/123'), null);
});

test('rejects off-site URLs and unsafe protocols', () => {
  assert.equal(normalizeUnstopEventUrl('https://example.com/hackathons/event'), null);
  assert.equal(normalizeUnstopEventUrl('javascript:alert(1)'), null);
});
