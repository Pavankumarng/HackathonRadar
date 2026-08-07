const { chromium } = require('playwright');

async function testUnstop() {
  console.log('Starting Unstop test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Intercept all requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('search') || url.includes('opportunity')) {
      console.log('Request:', url);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') && url.includes('search')) {
      console.log('Response from:', url);
      try {
        const json = await response.json();
        console.log('Keys in response:', Object.keys(json));
        if (json.data && json.data.data) {
          console.log(`Found ${json.data.data.length} items in API response!`);
          console.log('First item:', Object.keys(json.data.data[0]));
        }
      } catch (e) {
        console.log('Could not parse response as JSON for', url);
      }
    }
  });

  await page.goto('https://unstop.com/hackathons', { waitUntil: 'networkidle' });
  
  console.log('Page loaded, waiting 5 seconds...');
  await page.waitForTimeout(5000);
  
  // Let's also check the DOM structure for fallback
  const html = await page.content();
  console.log('HTML length:', html.length);
  
  const aTags = await page.$$eval('a', els => els.map(a => a.href).filter(href => href.includes('/hackathons/')));
  console.log(`Found ${aTags.length} links to hackathons in DOM`);
  if (aTags.length > 0) {
     console.log('Sample link:', aTags[0]);
  }
  
  await browser.close();
}

testUnstop().catch(console.error);
