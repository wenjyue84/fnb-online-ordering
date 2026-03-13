/**
 * One-time DB seed: migrate all 4 JSON config files into the site_settings table.
 *
 * Usage: node scripts/seed-settings.mjs
 *
 * Requires DATABASE_URL in environment or .env.local file.
 * After seeding, the admin panel Settings tab manages all settings persistently.
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT DO UPDATE (upsert).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Load .env.local if present
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const { neon } = await import("@neondatabase/serverless");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Add it to .env.local or export it.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function readJson(filename) {
  const fullPath = join(process.cwd(), "data", filename);
  if (!existsSync(fullPath)) {
    console.warn(`  WARNING: ${filename} not found — skipping`);
    return null;
  }
  return JSON.parse(readFileSync(fullPath, "utf-8"));
}

// New identity fields to merge into the 'site' key
const SITE_IDENTITY_FIELDS = {
  address:
    "Ground Floor 61, Jalan Impian Emas 5/1, Taman Impian Emas, 81300 Skudai, Johor, Malaysia",
  phone: "012-708 8789",
  neighborhood: "Taman Impian Emas (Skudai, Johor Bahru)",
  wifi: "ilovemakan",
  dietary: ["No Pork", "No Lard", "Halal-friendly"],
  displayHours: {
    daily: "11:00 AM - 11:00 PM",
    lastOrder: "10:30 PM",
  },
  social: {
    facebook: "https://www.facebook.com/MakanMomentsCafe",
    instagram: "https://www.instagram.com/MakanMomentsCafe",
    tiktok: "https://www.tiktok.com/@MakanMomentsCafe",
  },
  googleMapsEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.4!2d103.72!3d1.56!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMcKwMzMnNDAuNCJOIDEwM8KwNDMnMjAuMCJF!5e0!3m2!1sen!2smy!4v1",
  cafeTagline: "Thai Begins, Moments Stay",
  cafeNameMs: "Kafe Kenangan Makan",
  cafeNameZh: "Shi Guang Ji Yi",
};

async function main() {
  console.log("Creating site_settings table (idempotent)...");
  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("  ✓ site_settings table ready");

  const seeds = [
    { key: "site", file: "site-settings.json" },
    { key: "operating_hours", file: "operating-hours.json" },
    { key: "chat", file: "chat-settings.json" },
    { key: "time_slots", file: "time-slots.json" },
  ];

  for (const { key, file } of seeds) {
    const value = readJson(file);
    if (!value) continue;

    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = NOW()
    `;
    console.log(`  ✓ Seeded key: "${key}" (from data/${file})`);
  }

  // Merge new identity fields into the 'site' row, preserving any existing user-set values
  console.log("\nMerging identity fields into 'site' key...");
  const existingRows = await sql`SELECT value FROM site_settings WHERE key = 'site'`;
  const existing = existingRows.length ? existingRows[0].value : {};
  // Identity fields are defaults; existing DB values take precedence
  const merged = { ...SITE_IDENTITY_FIELDS, ...existing };
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('site', ${JSON.stringify(merged)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
  `;
  console.log("  ✓ Identity fields merged into 'site' key");

  console.log("\nDone. All settings are now in Neon — admin panel reads from DB.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
