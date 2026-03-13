const response = await fetch('http://localhost:3031/en/menu');
const html = await response.text();

// Find error-related content
const patterns = ['Something went wrong', 'Error:', 'error-boundary', 'errorComponent', 'Global error'];
for (const p of patterns) {
  const idx = html.indexOf(p);
  if (idx >= 0) {
    console.log(`Found "${p}" at ${idx}:`);
    console.log(html.substring(idx - 200, idx + 300));
    console.log('---');
  }
}

// Also check for the actual items count in RSC data
const nameEnCount = (html.match(/\\"nameEn\\"/g) || []).length;
console.log('nameEn count in RSC data:', nameEnCount);

// Check for displayCategories
const dispCatCount = (html.match(/\\"displayCategories\\"/g) || []).length;
console.log('displayCategories count:', dispCatCount);

// Count items in RSC data by looking for UUID patterns
const uuidCount = (html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || []).length;
console.log('UUID count in page:', uuidCount);
