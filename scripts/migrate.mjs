/**
 * Idempotent database migration script.
 *
 * Consolidates all CREATE TABLE / ALTER TABLE DDL that was previously scattered
 * across API route handlers and lib files. Run once at deploy time (before build)
 * or locally after schema changes.
 *
 * Usage:
 *   node scripts/migrate.mjs
 *
 * Requires DATABASE_URL (or DATABASE_URL_UNPOOLED) in environment or .env.local.
 * Uses the UNPOOLED (direct) connection when available, since DDL may require
 * session-level features incompatible with PgBouncer transaction mode.
 *
 * Safe to re-run — all statements use IF NOT EXISTS / IF NOT EXISTS guards.
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

// Prefer unpooled (direct) connection for DDL; fall back to pooled
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn("WARN: DATABASE_URL is not set — skipping migrations (build-only mode).");
  process.exit(0);
}

const sql = neon(DATABASE_URL);

// ── Migration steps ─────────────────────────────────────────────────────────

const migrations = [
  {
    name: "site_settings table",
    sql: `
      CREATE TABLE IF NOT EXISTS site_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
  },
  {
    name: "rate_limit_log table",
    sql: `
      CREATE TABLE IF NOT EXISTS rate_limit_log (
        ip           TEXT        NOT NULL,
        endpoint     TEXT        NOT NULL,
        window_start TIMESTAMPTZ NOT NULL,
        count        INT         NOT NULL DEFAULT 0,
        PRIMARY KEY (ip, endpoint, window_start)
      )
    `,
  },
  {
    name: "category_highlights table",
    sql: `
      CREATE TABLE IF NOT EXISTS category_highlights (
        category TEXT PRIMARY KEY,
        item_id  TEXT NOT NULL
      )
    `,
  },
  {
    name: "push_subscriptions table",
    sql: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         SERIAL PRIMARY KEY,
        endpoint   TEXT NOT NULL UNIQUE,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tray_orders table",
    sql: `
      CREATE TABLE IF NOT EXISTS tray_orders (
        id                     SERIAL PRIMARY KEY,
        items                  JSONB NOT NULL,
        total                  NUMERIC(8,2) NOT NULL,
        status                 TEXT NOT NULL DEFAULT 'pending_approval',
        contact_number         TEXT,
        estimated_arrival      TIMESTAMPTZ,
        estimated_ready        TIMESTAMPTZ,
        rejection_reason       TEXT,
        payment_screenshot_url TEXT,
        notification_status    TEXT NOT NULL DEFAULT 'pending',
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
  // tray_orders column additions (for databases created before these columns existed)
  { name: "tray_orders.contact_number", sql: "ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS contact_number TEXT" },
  { name: "tray_orders.estimated_arrival", sql: "ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMPTZ" },
  { name: "tray_orders.estimated_ready", sql: "ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS estimated_ready TIMESTAMPTZ" },
  { name: "tray_orders.rejection_reason", sql: "ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT" },
  { name: "tray_orders.payment_screenshot_url", sql: "ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT" },
  { name: "tray_orders.notification_status", sql: "ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'pending'" },
  // menu_items column additions
  { name: "menu_items.image_position", sql: "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_position TEXT DEFAULT '50% 50%'" },
  { name: "menu_items.is_signature", sql: "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_signature BOOLEAN DEFAULT false" },
  { name: "menu_items.archived", sql: "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false" },
  // item_display_categories column additions
  { name: "item_display_categories.sort_order", sql: "ALTER TABLE item_display_categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0" },
];

async function main() {
  console.log(`Running ${migrations.length} migrations against Neon...\n`);

  for (const m of migrations) {
    try {
      await sql.query(m.sql);
      console.log(`  ✓ ${m.name}`);
    } catch (err) {
      console.error(`  ✗ ${m.name}: ${err.message}`);
      process.exit(1);
    }
  }

  // Cleanup: remove stale rate_limit_log entries (> 2 days old)
  try {
    await sql.query("DELETE FROM rate_limit_log WHERE window_start < NOW() - INTERVAL '2 days'");
    console.log("  ✓ rate_limit_log cleanup (stale entries)");
  } catch {
    // Non-fatal — table may be empty
  }

  console.log("\nAll migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
