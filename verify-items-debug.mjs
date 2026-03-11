import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

// Wait for full hydration
await page.goto('http://localhost:3031/en/menu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Check the actual rendered menu items
const analysis = await page.evaluate(() => {
  const body = document.body;

  // Count elements that look like price tags
  const prices = [...body.querySelectorAll('*')].filter(el => {
    return el.children.length === 0 && el.textContent &&
      el.textContent.match(/^RM\s*\d+\.?\d*$/) &&
      el.textContent.length < 15;
  });

  // Count elements with currency
  const rmEls = [...body.querySelectorAll('*')].filter(el => {
    return el.children.length === 0 && el.textContent?.match(/RM\s*\d/);
  });

  // Find the visible text including "No items found" check
  const visText = body.innerText;
  const noItemsIdx = visText.indexOf('No items found');

  // Check what the initial React props might be - look in the script tags
  const scripts = [...document.querySelectorAll('script')].map(s => s.textContent?.substring(0, 100) || '');
  const hasItems = scripts.some(s => s.includes('"nameEn"') || s.includes('nameEn'));

  return {
    priceEls: prices.length,
    rmEls: rmEls.length,
    noItemsVisible: noItemsIdx >= 0,
    hasItemsInScripts: hasItems,
    visibleItemCount: prices.length,
    firstPriceText: prices[0]?.textContent,
  };
});

console.log('=== DEBUG ===');
console.log(JSON.stringify(analysis, null, 2));

// Also check if we can find the items in RSC data
const rscData = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll('script')];
  for (const s of scripts) {
    const text = s.textContent || '';
    if (text.includes('"nameEn"') && text.length > 1000) {
      return text.substring(0, 500);
    }
  }
  return null;
});
console.log('RSC data sample:', rscData?.substring(0, 200) || 'not found');

await browser.close();
