const response = await fetch('http://localhost:3031/api/admin/menu');
const items = await response.json();

// Check what categories exist and their item counts
const categoryCounts = {};
for (const item of items) {
  for (const cat of (item.categories || [])) {
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }
}

console.log('Category counts:');
for (const [cat, count] of Object.entries(categoryCounts).sort(([,a],[,b]) => b-a)) {
  console.log(`  ${cat}: ${count}`);
}

// Check time-based categories specifically
console.log('\n7 Lunch Lovers items:', items.filter(i => i.categories?.includes('7 Lunch Lovers')).length);
console.log('Must-Try items:', items.filter(i => i.categories?.includes('Must-Try')).length);
console.log('Break-Lunch items:', items.filter(i => i.categories?.includes('Break-Lunch')).length);
