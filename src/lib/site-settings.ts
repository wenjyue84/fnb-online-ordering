import sql from "@/lib/db";

export interface SiteSettings {
  defaultLocale: string;
  cafeName: string;
  currency: string;
  operatingHours: {
    open: string;
    lastOrder: string;
    close: string;
  };
  preOrderEnabled: boolean;
  depositRequired: boolean;
  paymentMethods: string[];
  tng_phone: string;
  tng_qr_url: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  defaultLocale: "en",
  cafeName: "Makan Moments",
  currency: "RM",
  operatingHours: {
    open: "11:00",
    lastOrder: "22:30",
    close: "23:00",
  },
  preOrderEnabled: true,
  depositRequired: false,
  paymentMethods: ["Touch & Go", "Cash on Arrival"],
  tng_phone: "",
  tng_qr_url: "",
};

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
