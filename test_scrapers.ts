import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\nTesting Unstop API...');
  await page.goto('https://unstop.com/hackathons', { waitUntil: 'domcontentloaded' });
  const unstopReq = await page.waitForResponse(r => r.url().includes('search') && r.status() === 200, { timeout: 10000 }).catch(e => null);
  if (unstopReq) {
    const unstopJson = await unstopReq.json().catch(e => null);
    console.log('Unstop JSON keys:', Object.keys(unstopJson || {}));
    if (unstopJson?.data) console.log('Unstop data keys:', Object.keys(unstopJson.data));
  } else {
    console.log('Unstop API timed out.');
  }

  console.log('\nTesting Devpost DOM...');
  await page.goto('https://devpost.com/hackathons');
  const devpostTitles = await page.$$eval('.software-entry, .hackathon-tile, [data-role="hackathon"], .clearfix.mb-4, article, .content h3, h3', els => els.map(e => e.textContent?.trim()).slice(0, 10));
  console.log('Devpost possible titles:', devpostTitles);

  console.log('\nTesting HackCulture DOM...');
  await page.goto('https://hackculture.in/hackathons');
  const hcTitles = await page.$$eval('a, h2, h3, .card', els => els.map(e => e.textContent?.trim()).slice(0, 10));
  console.log('HackCulture possible text:', hcTitles);

  await browser.close();
})();
