/**
 * scripts/scraper/utils/browser.ts
 *
 * Shared Playwright browser factory with stealth + anti-bot hardening.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';

// Register stealth plugin once at module level
chromium.use(StealthPlugin());

// ─── User-Agent pool ─────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Random delay between min and max ms */
export async function randomDelay(minMs = 1500, maxMs = 4000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff delay: attempt 0=1s, 1=2s, 2=4s */
export async function backoffDelay(attempt: number): Promise<void> {
  const ms = Math.pow(2, attempt) * 1000;
  console.log(`[browser] Backoff ${ms}ms before retry ${attempt + 1}`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Browser singleton ────────────────────────────────────────────────────────
let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1366,768',
      ],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// ─── Context / Page factory ───────────────────────────────────────────────────

export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const ua = randomUserAgent();
  const ctx = await browser.newContext({
    userAgent: ua,
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'DNT': '1',
    },
  });
  return ctx;
}

export async function newPage(ctx?: BrowserContext): Promise<{ page: Page; context: BrowserContext }> {
  const context = ctx ?? (await newContext());
  const page = await context.newPage();

  // Mask navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  return { page, context };
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

/**
 * Run an async operation with up to `maxAttempts` retries and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  label = 'operation'
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`[browser] ${label} failed on attempt ${attempt + 1}/${maxAttempts}:`, err);
      if (attempt < maxAttempts - 1) {
        await backoffDelay(attempt);
      }
    }
  }
  throw lastError;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safe text extractor — returns '' instead of throwing */
export async function safeText(page: Page, selector: string): Promise<string> {
  try {
    return (await page.textContent(selector, { timeout: 5000 })) ?? '';
  } catch {
    return '';
  }
}

/** Safe attribute extractor */
export async function safeAttr(page: Page, selector: string, attr: string): Promise<string> {
  try {
    return (await page.getAttribute(selector, attr, { timeout: 5000 })) ?? '';
  } catch {
    return '';
  }
}

/** Grab og:image or twitter:image from <head> */
export async function getOgImage(page: Page): Promise<string | undefined> {
  const og = await safeAttr(page, 'meta[property="og:image"]', 'content');
  if (og) return og;
  const twitter = await safeAttr(page, 'meta[name="twitter:image"]', 'content');
  return twitter || undefined;
}

/** Scroll to the bottom of the page to trigger lazy loads */
export async function scrollToBottom(page: Page, scrollSteps = 5): Promise<void> {
  for (let i = 0; i < scrollSteps; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await page.waitForTimeout(600);
  }
  // scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
}
