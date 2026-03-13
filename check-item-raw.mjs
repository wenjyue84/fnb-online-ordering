// Check raw item data from the admin API to see exact field values
const response = await fetch('http://localhost:3031/api/admin/menu');
const items = await response.json();

// Print the first item with all fields
console.log('First item full data:');
console.log(JSON.stringify(items[0], null, 2));

console.log('\nChecking available_days field values:');
const daysSamples = items.slice(0, 5).map(i => ({
  name: i.name_en,
  available_days: i.available_days,
  time_from: i.time_from,
  time_until: i.time_until,
  special_dates: i.special_dates,
}));
console.log(JSON.stringify(daysSamples, null, 2));
