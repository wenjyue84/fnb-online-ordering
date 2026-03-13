import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

// Intercept console logs to get component data
const logs = [];
page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

// Navigate and wait longer for full hydration
await page.goto('http://localhost:3031/en/menu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Try to get the actual DOM state
const domState = await page.evaluate(() => {
  // Check for actual menu item DOM elements
  const priceEls = [...document.querySelectorAll('span, p, div')]
    .filter(el => el.children.length === 0 && /^RM\d+/.test(el.textContent?.trim() || ''));

  // Find all h2 elements (category headings)
  const h2s = [...document.querySelectorAll('h2')].map(h => h.textContent?.trim());

  // Check if TrayContext is providing data
  const trayEl = document.querySelector('[data-tray], [class*="tray"]');

  // Get body text sample
  const bodyText = document.body.innerText.substring(0, 1000);

  return {
    priceEls: priceEls.length,
    h2s: h2s.slice(0, 5),
    hasTray: !!trayEl,
    bodyTextSample: bodyText.substring(0, 300),
  };
});

console.log('DOM state:', JSON.stringify(domState, null, 2));
console.log('Console logs:', logs.filter(l => l.type === 'error').slice(0, 5));

// Check category filter state
const filterState = await page.evaluate(() => {
  const filterBtns = [...document.querySelectorAll('button[class*="rounded-full"]')];
  const activeBtn = filterBtns.find(b => b.getAttribute('aria-selected') === 'true' || b.className.includes('bg-foreground') || b.style.background);
  return {
    filterButtonCount: filterBtns.length,
    activeBtnText: activeBtn?.textContent?.trim() || 'none found',
    allBtnTexts: filterBtns.slice(0, 5).map(b => b.textContent?.trim()),
  };
});

console.log('Filter state:', JSON.stringify(filterState, null, 2));

await browser.close();
