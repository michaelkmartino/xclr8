import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/home/claude/screenshots/1-jobs.png' });

// Click into the Bay Ridge Prep job
await page.getByText('Bay Ridge Prep').first().click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/home/claude/screenshots/2-job-quotes.png' });

// Click into the Base Bid quote
await page.getByText('Base Bid').first().click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/home/claude/screenshots/3-quote-versions.png' });

// Click into the reporting version (v2)
await page.getByText(/^v2/).first().click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/home/claude/screenshots/4-version-line-items.png' });

// Click into the line item
await page.getByText('2x4 LED Troffer').first().click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/home/claude/screenshots/5-line-item-pricing.png' });

await browser.close();
console.log('done');
