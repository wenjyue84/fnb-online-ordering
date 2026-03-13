import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const errors = [];
const warnings = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
  if (msg.type() === 'warning' || msg.type() === 'warn') warnings.push(msg.text());
});
page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));

await page.goto('http://localhost:3031/en/menu', { waitUntil: 'networkidle', timeout: 30000 });

// Wait a bit more for React hydration
await page.waitForTimeout(2000);

// Count actual menu item cards
const itemCount = await page.evaluate(() => {
  const cards = document.querySelectorAll('[class*="rounded"][class*="bg"], article, [data-item]');
  return cards.length;
});

// Check visible text for items
const visibleText = await page.evaluate(() => document.body.innerText);
const hasNoItemsVisible = visibleText.includes('No items found');
const itemNames = visibleText.match(/Buttermilk|Chicken|Tom Yum|Noodle|Soup/g);

// Count price elements in visible text
const prices = visibleText.match(/RM\s*\d+/g);

console.log('=== MENU PAGE ANALYSIS ===');
console.log('Has "No items found" visible:', hasNoItemsVisible);
console.log('Price in visible text:', prices?.length || 0, prices?.slice(0, 3));
console.log('Item names found:', itemNames?.length || 0, itemNames?.slice(0, 3));
console.log('Generic cards found:', itemCount);
console.log('Errors:', errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : 'NONE');
console.log('Warnings:', warnings.length > 0 ? JSON.stringify(warnings.slice(0, 3)) : 'NONE');

// Take screenshot
await page.screenshot({ path: 'screenshots/menu-hydrated.png', fullPage: false });

await browser.close();
