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
  address: string;
  phone: string;
  neighborhood: string;
  wifi: string;
  dietary: string[];
  displayHours: {
    daily: string;
    lastOrder: string;
  };
  social: {
    facebook: string;
    instagram: string;
    tiktok: string;
  };
  googleMapsEmbed: string;
  cafeTagline: string;
  cafeNameMs: string;
  cafeNameZh: string;
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
