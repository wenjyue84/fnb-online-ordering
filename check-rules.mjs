const response = await fetch('http://localhost:3031/api/admin/rules');
const rules = await response.json();
console.log('Total rules:', rules.length);
for (const r of rules) {
  console.log('\n--- Rule:', r.name);
  console.log('Type:', r.rule_type, '| Active:', r.active);
  console.log('Target:', r.target_type, '| Categories:', r.target_categories?.length || 0, '| Items:', r.target_item_ids?.length || 0);
  console.log('Time:', r.time_from || 'any', '->', r.time_until || 'any');
}
