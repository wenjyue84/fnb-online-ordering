import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:3031/en/menu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const beforeState = await page.evaluate(() => ({
  bodyText: document.body.innerText.substring(0, 200),
  priceCount: [...document.querySelectorAll('*')].filter(el => el.children.length === 0 && /^RM\s*\d+/.test(el.textContent?.trim() || '')).length,
}));
console.log('BEFORE click:', JSON.stringify(beforeState));

// Click "All" category button
try {
  // The filter is fixed at bottom on mobile - click the "All" button
  const allBtn = page.locator('button', { hasText: 'All' }).first();
  await allBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  const afterState = await page.evaluate(() => ({
    bodyText: document.body.innerText.substring(0, 200),
    priceCount: [...document.querySelectorAll('*')].filter(el => el.children.length === 0 && /^RM\s*\d+/.test(el.textContent?.trim() || '')).length,
    h2s: [...document.querySelectorAll('h2')].map(h => h.textContent?.trim()).slice(0, 3),
  }));
  console.log('AFTER click All:', JSON.stringify(afterState));
} catch (e) {
  console.log('Error clicking All:', e.message);
}

// Also try clicking Must-Try
try {
  const mustTryBtn = page.locator('button', { hasText: 'Must-Try' }).first();
  await mustTryBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  const afterMustTry = await page.evaluate(() => ({
    bodyText: document.body.innerText.substring(200, 400),
    priceCount: [...document.querySelectorAll('*')].filter(el => el.children.length === 0 && /^RM\s*\d+/.test(el.textContent?.trim() || '')).length,
    h2s: [...document.querySelectorAll('h2')].map(h => h.textContent?.trim()).slice(0, 3),
  }));
  console.log('AFTER click Must-Try:', JSON.stringify(afterMustTry));
} catch (e) {
  console.log('Error clicking Must-Try:', e.message);
}

console.log('Errors:', errors.slice(0, 5));

await browser.close();
