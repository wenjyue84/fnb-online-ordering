/**
 * Verify that all required site_settings keys are seeded in Neon.
 *
 * Usage: node scripts/verify-seed.mjs
 *
 * Requires DATABASE_URL in environment or .env.local file.
 * Exits 0 if all 4 required keys exist, exits 1 if any are missing.
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

const REQUIRED_KEYS = ["site", "operating_hours", "chat", "time_slots"];

async function main() {
  try {
    console.log("Verifying site_settings keys in Neon...");

    const result = await sql`
      SELECT key FROM site_settings WHERE key IN (${REQUIRED_KEYS.join(",")})
    `;

    const foundKeys = new Set(result.map((row) => row.key));
    const missingKeys = REQUIRED_KEYS.filter((key) => !foundKeys.has(key));

    if (missingKeys.length === 0) {
      console.log(`✓ PASS: All 4 settings keys present in DB`);
      process.exit(0);
    } else {
      console.error(`✗ MISSING keys in site_settings:`);
      for (const key of missingKeys) {
        console.error(`  - ${key}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

main();
