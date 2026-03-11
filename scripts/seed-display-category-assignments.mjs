/**
 * Seed display category assignments for all unassigned menu items.
 * Also creates missing "Ala Carte" and "Soups" display categories.
 * Run: node scripts/seed-display-category-assignments.mjs
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_a9HTlJp6ifbY@ep-royal-cherry-a1yekkd8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

// ── New display categories to create ────────────────────────────────────────
// sort_order 1 = appears first in nav (before Rice Plates @ 2)
const NEW_CATEGORIES = [
  { name: 'Ala Carte', sort_order: 1 },
  { name: 'Soups',     sort_order: 1 },
];

// ── Item assignments: category name → item codes ─────────────────────────────
const ASSIGNMENTS = {

  'Ala Carte': [
    // Chicken
    'AC01', 'AC02', 'AC03', 'AC04', 'AC05', 'AC06', 'AC07', 'AC08', 'AC11',
    // Eggs
    'AE01', 'AE02', 'AE03', 'AE04', 'AE05',
    // Fish (slices)
    'AF01', 'AF02', 'AF03', 'AF04', 'AF05',
    'AF06K_Kong_Po_Fish_S', 'AF06L_Lemon_Spicy_St',
    // Siakap (premium fish slices)
    'AFS1_Buttermilk_Fish', 'AFS2_Sweet_&_Sour_Fi', 'AFS3_Salted_Egg_Fish',
    'AFS4_Black_Pepper_Fi', 'AFS5_Ginger_Onion_Fi', 'AFS6K_Kong_Po_Fish_S',
    // Vegetables, tofu, beef, prawn
    'AV01', 'AV02', 'AV03', 'AV04', 'AV05', 'AV06', 'AV07', 'AV08', 'AV09',
    'AV10', 'AV11', 'AV12', 'AV13', 'AV14', 'AV15', 'AV16', 'AV17', 'AV18',
    'AV19', 'AV20', 'AV21', 'AV22', 'AV23', 'AV24', 'AV30',
    'AV70', 'AV71', 'AV72', 'AV73',
  ],

  'Soups': [
    // Tom Yum soups (standalone — no rice)
    'AS01', 'AS01B_Chicken_Tomyum',
    'AS02', 'AS02B_Seafood_Tomyum',
    // Daily chicken soup (standalone — no rice)
    'AS10', 'AS10B_Daily_Chicken_', 'AS11B_Choy_Sum_Soup',
  ],

  // Assign to existing "Rice Plates"
  'Rice Plates': [
    // Daily Special Soups (come with rice)
    'DS01', 'DS02', 'DS03', 'DS04', 'DS05', 'DS06', 'DS07', 'DS11', 'DS12',
    // Nasi Goreng varieties (Ala Cart section in POS, rice-based)
    'TM06', 'TM07', 'TM08', 'TM09', 'TM10', 'TM11',
    // ADDON-style rice items
    'Nasi_Goreng_Ayam', 'Nasi_Goreng_Daging',
  ],

  // Assign to existing "Hot Drinks"
  'Hot Drinks': [
    'H226',  // Hot Chinese Tea
  ],

  // Assign to existing "Desserts"
  'Desserts': [
    'Gui_lin_gao/Chinese_',  // Chinese herbal jelly
  ],

  // Assign to existing "Snacks"
  'Snacks': [
    // Add-ons / sides
    'ADD01',  // Fried Egg
    'ADD04',  // White rice
    'ADD05',  // Nasi Lemak (add-on)
    'ADD06',  // Fried Chicken (add-on)
    'ADD10',  // Prawnx2
    'ADD11',  // Squidx3
  ],

  // Assign large-format fish dishes to existing "Sharing Sets"
  'Sharing Sets': [
    'AF06',   // Thai Sauce Fried Fish (whole fish)
    'AF07',   // Sweet & Sour Fried Fish (whole fish)
    'AF08',   // Hong Kong Style Steamed Fish (whole fish)
    'AF09',   // Thai Sauce Fried Fish (whole fish)
    'AF10',   // Spicy Indonesian Curry Claypot Chicken
    'AF11',   // Spicy Indonesian Curry Claypot Prawn
    'AF12',   // Fried Fish With Green Curry
  ],

  // TA1 / TA2 (takeaway surcharge) — left unassigned intentionally
};

async function main() {
  // ── Step 1: Create missing display categories ────────────────────────────
  console.log('Creating new display categories...');
  for (const cat of NEW_CATEGORIES) {
    await sql`
      INSERT INTO display_categories (name, sort_order, active)
      VALUES (${cat.name}, ${cat.sort_order}, true)
      ON CONFLICT (name) DO NOTHING
    `;
    console.log(`  ✓ "${cat.name}" (sort_order ${cat.sort_order})`);
  }

  // ── Step 2: Load all display category IDs ────────────────────────────────
  const dcRows = await sql`SELECT id, name FROM display_categories`;
  const dcMap = Object.fromEntries(dcRows.map(r => [r.name, r.id]));
  console.log('\nDisplay category IDs:');
  Object.entries(dcMap).forEach(([name, id]) => console.log(`  ${id}: ${name}`));

  // ── Step 3: Load all menu item IDs by code ────────────────────────────────
  const itemRows = await sql`SELECT id, code, name_en FROM menu_items`;
  const itemMap = Object.fromEntries(itemRows.map(r => [r.code, { id: r.id, name: r.name_en }]));

  // ── Step 4: Assign items ──────────────────────────────────────────────────
  let totalInserted = 0;
  let totalSkipped = 0;
  let notFound = [];

  console.log('\nAssigning items...');
  for (const [catName, codes] of Object.entries(ASSIGNMENTS)) {
    const catId = dcMap[catName];
    if (!catId) {
      console.error(`  ✗ Display category not found: "${catName}"`);
      continue;
    }
    let catInserted = 0;
    let catSkipped = 0;
    for (const code of codes) {
      const item = itemMap[code];
      if (!item) {
        notFound.push(code);
        continue;
      }
      const result = await sql`
        INSERT INTO item_display_categories (item_id, display_category_id)
        VALUES (${item.id}, ${catId})
        ON CONFLICT DO NOTHING
        RETURNING item_id
      `;
      if (result.length > 0) {
        catInserted++;
        totalInserted++;
      } else {
        catSkipped++;
        totalSkipped++;
      }
    }
    console.log(`  [${catName}] +${catInserted} new, ${catSkipped} already assigned`);
  }

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  console.log(`\nDone. Total: +${totalInserted} new assignments, ${totalSkipped} already existed`);
  if (notFound.length > 0) {
    console.warn(`Not found in DB (${notFound.length}): ${notFound.join(', ')}`);
  }

  // ── Step 6: Verify unassigned count ──────────────────────────────────────
  const remaining = await sql`
    SELECT mi.code, mi.name_en
    FROM menu_items mi
    WHERE NOT EXISTS (
      SELECT 1 FROM item_display_categories idc WHERE idc.item_id = mi.id
    )
    AND (mi.archived IS NULL OR mi.archived = false)
    ORDER BY mi.code
  `;
  console.log(`\nStill unassigned: ${remaining.length}`);
  remaining.forEach(r => console.log(`  ${r.code} — ${r.name_en}`));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
