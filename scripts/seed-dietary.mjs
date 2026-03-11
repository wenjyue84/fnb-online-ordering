/**
 * seed-dietary.mjs — Batch-assign Dietary tags for all menu items.
 *
 * Logic:
 *  - Vegetarian : pure veg / egg / dairy / tofu / fruits / plain drinks
 *  - Spicy      : items that are inherently spicy by dish type
 *  - Items that get BOTH (e.g., spicy veg sambal) get both tags.
 *  - Seafood / meat / ambiguous sauce items are left without Vegetarian.
 *
 * Run:  node scripts/seed-dietary.mjs
 * Dry:  DRY_RUN=1 node scripts/seed-dietary.mjs
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

// Read DATABASE_URL from .env.local without requiring dotenv
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbMatch) throw new Error("DATABASE_URL not found in .env.local");
const DATABASE_URL = dbMatch[1].trim().replace(/^["']|["']$/g, "");

const sql = neon(DATABASE_URL);
const DRY_RUN = process.env.DRY_RUN === "1";

// ── Dietary rules ────────────────────────────────────────────────────────────
// Key: item code or prefix pattern (startsWith match)
// Value: array of dietary tags to SET (replaces current value)
//
// Items not listed here keep their existing dietary array unchanged.

const VEGETARIAN = "Vegetarian";
const SPICY = "Spicy";

/** Map<code, string[]> — exact code matches */
const EXACT = new Map([
  // ── Vegetable ala carte ─────────────────────────────────────────────────
  ["AV01", [VEGETARIAN, SPICY]],  // Kangkung With Sambal (sambal = spicy)
  ["AV02", [VEGETARIAN]],         // Kangkung With Garlic
  ["AV03", [VEGETARIAN]],         // Thai Style Fried Tofu
  ["AV04", [VEGETARIAN]],         // Mixed Vegetables
  ["AV06", [VEGETARIAN]],         // Choy Sum With Garlic
  ["AV07", [VEGETARIAN]],         // Bean Sprouts With Garlic
  ["AV09", [VEGETARIAN]],         // Signature Sweet & Sour Steamed Tofu
  ["AV11", [VEGETARIAN]],         // Okra With Garlic
  ["AV13", [VEGETARIAN]],         // Fried Kangkung
  ["AV14", [VEGETARIAN]],         // Fried Okra
  ["AV15", [VEGETARIAN]],         // Fried Mushroom
  ["AV17", [VEGETARIAN]],         // 4 Heavenly King (mixed veg)
  ["AV18", [VEGETARIAN, SPICY]],  // Daun Keledek Sambal
  ["AV19", [VEGETARIAN]],         // Sweet Potato Leave With Garlic
  ["AV30", [SPICY]],              // Thai Basil Chicken Minced + Tofu (has chicken)

  // Beef / Prawn AV — not vegetarian, some spicy
  ["AV20", []],                   // Beef Gyu-Onion
  ["AV21", [SPICY]],              // Black Pepper Beef
  ["AV22", [SPICY]],              // Spicy Curry Claypot Beef
  ["AV23", [SPICY]],              // Thai Basil Beef
  ["AV24", [SPICY]],              // Kong Po Beef
  ["AV70", []],                   // Buttermilk Prawn
  ["AV71", []],                   // Salted Egg Prawn
  ["AV72", [SPICY]],              // Black Pepper Prawn
  ["AV73", [SPICY]],              // Kong Po Prawn

  // ── Eggs ────────────────────────────────────────────────────────────────
  ["AE01", [VEGETARIAN, SPICY]],  // Thai Omelette (Thai sauce = spicy)
  ["AE02", [VEGETARIAN]],         // Onion Omelette
  ["AE03", []],                   // Prawn Omelette
  ["AE04", [VEGETARIAN]],         // Radish Omelette
  ["AE05", [VEGETARIAN]],         // Tomato Egg
  ["ADD01", [VEGETARIAN]],        // Fried Egg

  // ── Soups (Tomyum = spicy) ───────────────────────────────────────────────
  ["AS01", [SPICY]],
  ["AS01B", [SPICY]],
  ["AS02", [SPICY]],
  ["AS02B", [SPICY]],
  ["AS10", []],                   // Daily Chicken Soup — mild
  ["AS10B", []],
  ["AS11B", [VEGETARIAN]],        // Choy Sum Soup

  // ── Ala Carte Chicken (spicy items) ─────────────────────────────────────
  ["AC06", [SPICY]],              // Kong Po Chicken
  ["AC07", [SPICY]],              // Green Curry Chicken
  ["AC08", [SPICY]],              // Nanyang Curry Chicken
  ["AC11", [SPICY]],              // Thai Basil Chicken Minced

  // ── Ala Carte Fish (spicy items) ─────────────────────────────────────────
  ["AF06L", [SPICY]],             // Lemon Spicy Steamed Fish
  ["AF10", [SPICY]],              // Spicy Indonesian Curry Claypot Chicken
  ["AF11", [SPICY]],              // Spicy Indonesian Curry Claypot Prawn
  ["AF12", [SPICY]],              // Fried Fish With Green Curry
  ["AV05", [SPICY]],              // Lemon Spicy Steamed Squid (misclassified as AV)

  // ── Desserts ─────────────────────────────────────────────────────────────
  ["DD01", [VEGETARIAN]],         // Daily Dessert (assume veg)
  ["DD02", [VEGETARIAN]],         // Bubur Cha Cha

  // ── Add-ons ──────────────────────────────────────────────────────────────
  ["ADD04", [VEGETARIAN]],        // White rice
  ["ADD05", []],                  // Nasi Lemak (has anchovies in sambal)

  // ── Fried Rice (TM category) ─────────────────────────────────────────────
  ["TM01", [SPICY]],              // Sambal Fried Rice
  ["TM01B", [SPICY]],
  ["TM02", [SPICY]],              // Tomyum Fried Rice
  ["TM02B", [SPICY]],
  ["TM05", [SPICY]],              // Chilli Minced Meat Rice
  ["TM05B", [SPICY]],

  // ── Must-Try (MT) ────────────────────────────────────────────────────────
  ["MT04", [SPICY]],              // Seafood Tomyum
  ["MT05", [SPICY]],              // Tomyum Chicken Soup With Rice

  // ── Snacks ───────────────────────────────────────────────────────────────
  ["SF01", [VEGETARIAN]],         // Golden French Fries
  ["SF01B", [VEGETARIAN, SPICY]], // Little Spicy French Fries
  ["SF01BC", [VEGETARIAN, SPICY]],
  ["SF01BM", [VEGETARIAN, SPICY]],
  ["SF06", [VEGETARIAN]],         // Fried Tofu Skin
  ["SF07", [VEGETARIAN]],         // Crispy Tofu & Tempeh
  ["SF09", [VEGETARIAN]],         // Green Salad Sesame
  ["SF10", [VEGETARIAN]],         // Green Salad Thousand Island
  ["SF23", [VEGETARIAN]],         // Vegetable Curry Puff
  ["SF24", [VEGETARIAN]],         // Vegetable Samosa
  ["SF25", [VEGETARIAN]],         // Vegetable Spring Roll

  // ── Noodle Soup ──────────────────────────────────────────────────────────
  ["NS03", [SPICY]],              // Thai Tomyum Seafood Bee Hoon
  ["NS04", [SPICY]],              // Thai Tomyum Chicken Bee Hoon
  ["NS06", [SPICY]],              // Thai Tomyum Seafood Mama Mee

  // ── Break-Lunch ──────────────────────────────────────────────────────────
  ["BF05", [VEGETARIAN, SPICY]],  // Gado Gado Bee Hoon (slightly spicy)
  ["BF08", [SPICY]],              // Thai Tom Yum Mama Mee

  // ── Toast (all bread-based = vegetarian unless tuna/meat) ────────────────
  ["T100", [VEGETARIAN]],
  ["T101", [VEGETARIAN]],
  ["T102", [VEGETARIAN]],
  ["T103", [VEGETARIAN]],
  ["T104", [VEGETARIAN]],
  ["T105", [VEGETARIAN]],
  ["T106", [VEGETARIAN]],
  ["T107", [VEGETARIAN]],
  ["T108", [VEGETARIAN]],
  ["T109", [VEGETARIAN]],
  ["T111", [VEGETARIAN]],         // Croissant Butter Kaya
  ["T113", [VEGETARIAN]],         // Sandwich Egg Mayo
  ["T114", [VEGETARIAN, SPICY]],  // Sandwich Sambal
  ["T117", [VEGETARIAN]],
  ["T118", [VEGETARIAN]],
  ["T119", [VEGETARIAN]],
  ["T121", [VEGETARIAN]],         // Half Boiled Egg
  ["T122", [VEGETARIAN]],         // Polo Bun Original
  ["T125", [VEGETARIAN]],         // Croissant Original
  ["T126", [VEGETARIAN, SPICY]],  // Croissant Sambal Egg
  ["T127", [VEGETARIAN]],         // Sandwich Egg Mayo Cheese
  ["T128", [VEGETARIAN, SPICY]],  // Sandwich Sambal Egg
  ["T129", [VEGETARIAN, SPICY]],  // Curry Potato + Toast

  // ── Ice Cream ─────────────────────────────────────────────────────────────
  ["IC01", [VEGETARIAN]],
  ["IC02", [VEGETARIAN]],
  ["IC03", [VEGETARIAN]],
  ["IC04", [VEGETARIAN]],
  ["IC05", [VEGETARIAN]],
  ["IC06", [VEGETARIAN]],
  ["IC07", [VEGETARIAN]],
  ["IC08", [VEGETARIAN]],
  ["IC09", [VEGETARIAN]],
  ["IC10", [VEGETARIAN]],
  ["IC11", [VEGETARIAN]],

  // ── Add-on rice ───────────────────────────────────────────────────────────
  ["White_rice", [VEGETARIAN]],
  ["ADD04", [VEGETARIAN]],
]);

/** Prefix rules applied to codes NOT found in EXACT */
const PREFIX_RULES = [
  // All beverages — Hot (H/B prefixes) → Vegetarian
  { prefix: "H2", tags: [VEGETARIAN] },
  { prefix: "B4", tags: [VEGETARIAN] },
  // Cold drinks
  { prefix: "C2", tags: [VEGETARIAN] },
  { prefix: "C3", tags: [VEGETARIAN] },
  { prefix: "C4", tags: [VEGETARIAN] },
  // Fresh juices
  { prefix: "FJ", tags: [VEGETARIAN] },
  // Dessert drinks
  { prefix: "DM", tags: [VEGETARIAN] },
  // Ice cream
  { prefix: "IC", tags: [VEGETARIAN] },
  // Daily special soup (chicken-based, no veg)
  { prefix: "DS", tags: [] },
];

async function main() {
  const rows = await sql`SELECT id, code, name_en, dietary FROM menu_items ORDER BY sort_order ASC, name_en ASC`;

  console.log(`\nTotal items in DB: ${rows.length}\n`);

  let updated = 0;
  let skipped = 0;
  const changes = [];

  // Sort EXACT keys longest-first so more specific patterns win
  const exactKeys = [...EXACT.keys()].sort((a, b) => b.length - a.length);

  for (const row of rows) {
    const code = row.code ?? "";
    let newTags;

    // 1. Exact match
    if (EXACT.has(code)) {
      newTags = EXACT.get(code);
    } else {
      // 2. startsWith match against EXACT keys (handles truncated DB codes like AS01B_Chicken_Tomyum)
      const exactPrefix = exactKeys.find((k) => code.startsWith(k));
      if (exactPrefix) {
        newTags = EXACT.get(exactPrefix);
      } else {
        // 3. PREFIX_RULES
        const rule = PREFIX_RULES.find((r) => code.startsWith(r.prefix));
        if (rule) {
          newTags = rule.tags;
        } else {
          skipped++;
          continue; // leave unchanged
        }
      }
    }

    const current = (row.dietary ?? []).slice().sort().join(",");
    const next = newTags.slice().sort().join(",");

    if (current === next) {
      skipped++;
      continue;
    }

    changes.push({ id: row.id, code, name: row.name_en, from: row.dietary, to: newTags });

    if (!DRY_RUN) {
      await sql`UPDATE menu_items SET dietary = ${newTags}, updated_at = now() WHERE id = ${row.id}`;
    }
    updated++;
  }

  console.log("Changes" + (DRY_RUN ? " [DRY RUN - not saved]" : "") + ":");
  for (const c of changes) {
    console.log(
      `  ${c.code.padEnd(20)} ${(c.from ?? []).join(",").padEnd(25) || "(none)".padEnd(25)} → ${(c.to).join(",") || "(none)"}`
    );
  }

  console.log(`\nUpdated: ${updated}  |  Skipped (no change / not in rules): ${skipped}`);
  if (DRY_RUN) console.log("DRY_RUN=1 — no changes written to DB. Remove DRY_RUN=1 to apply.");
}

main().catch((e) => { console.error(e); process.exit(1); });
