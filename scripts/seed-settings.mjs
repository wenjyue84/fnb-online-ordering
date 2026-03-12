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

  console.log("\nDone. All settings are now in Neon — admin panel reads from DB.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
