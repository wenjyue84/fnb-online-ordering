import sql from "@/lib/db";
export { DEFAULT_SETTINGS } from "./site-settings-shared";
export type { SiteSettings } from "./site-settings-shared";
import type { SiteSettings } from "./site-settings-shared";
import { DEFAULT_SETTINGS } from "./site-settings-shared";

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
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
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('site', ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
  `;
}
