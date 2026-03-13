const response = await fetch('http://localhost:3031/api/admin/menu');
const items = await response.json();

const withDays = items.filter(i => i.available_days && i.available_days.length > 0);
const withTime = items.filter(i => i.time_from || i.time_until);
const noRestrictions = items.filter(i => {
  const noDays = !i.available_days || i.available_days.length === 0;
  const noTime = !i.time_from && !i.time_until;
  const noSpecial = !i.special_dates || i.special_dates.length === 0;
  return noDays && noTime && noSpecial;
});

console.log('Total items:', items.length);
console.log('With available_days:', withDays.length);
console.log('With time restriction:', withTime.length);
console.log('No restrictions (always available):', noRestrictions.length);
if (withDays.length > 0) {
  console.log('Sample days item:', withDays[0].name_en, 'days:', JSON.stringify(withDays[0].available_days));
}
if (noRestrictions.length === 0) {
  console.log('ALL items have restrictions! Sample:', JSON.stringify(items[0], null, 2).substring(0, 400));
}
