// Check what the menu page returns
const response = await fetch('http://localhost:3031/en/menu');
const html = await response.text();

// Check for items
const hasNoItems = html.includes('No items found') || html.includes('noResults');
const priceMatches = (html.match(/RM\d+\.\d+/g) || []).length;

// Look for script data that might have items
const dataChunks = html.match(/\\"nameEn\\":/g);

console.log('Has "No items found" text:', hasNoItems);
console.log('Price instances (RM##.##):', priceMatches);
console.log('nameEn instances in scripts:', dataChunks?.length || 0);
console.log('HTML size:', html.length);

// Find the actual text around noResults
if (hasNoItems) {
  const idx = html.indexOf('No items found');
  if (idx >= 0) {
    console.log('Context around "No items found":', html.substring(idx - 100, idx + 100));
  }
}
