import sql from "@/lib/db";
export { DEFAULT_SETTINGS } from "./site-settings-shared";
export type { SiteSettings } from "./site-settings-shared";
import type { SiteSettings } from "./site-settings-shared";
import { DEFAULT_SETTINGS } from "./site-settings-shared";

async function ensureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    await ensureTable();
    const rows = await sql<{ value: SiteSettings }>`
      SELECT value FROM site_settings WHERE key = 'site'
    `;
    if (!rows.length) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(rows[0].value as SiteSettings) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSiteSettings(data: SiteSettings): Promise<void> {
  await ensureTable();
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('site', ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
  `;
}
