const response = await fetch('http://localhost:3031/en/menu');
const html = await response.text();

// Find nameEn in the HTML - where exactly?
const count = (html.match(/"nameEn"/g) || []).length;
console.log('nameEn count in HTML:', count);

// Find if items are in RSC payload (inline scripts)
const rscMarkers = (html.match(/\$RC|\$L|self\.__next/g) || []).length;
console.log('RSC markers:', rscMarkers);

// Look for the MenuGrid component data
const itemsInScript = html.includes('displayCategories') && html.includes('nameEn');
console.log('Items data in scripts:', itemsInScript);

// Find context of nameEn usage
const idx = html.indexOf('"nameEn"');
if (idx >= 0) {
  console.log('Context of nameEn:', html.substring(idx - 50, idx + 100));
}

// Check for error boundaries
const hasError = html.includes('Something went wrong') || html.includes('Error:') || html.includes('error-boundary');
console.log('Has error in HTML:', hasError);

// Find all Next.js inline script data (size)
const inlineScripts = html.match(/<script[^>]*>(.*?)<\/script>/gs) || [];
console.log('Inline script count:', inlineScripts.length);
console.log('Total inline script size:', inlineScripts.reduce((s, sc) => s + sc.length, 0));
