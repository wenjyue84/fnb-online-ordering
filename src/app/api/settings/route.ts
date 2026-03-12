import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

// Public endpoint — no auth required.
// Returns only the fields safe to expose to customers (TnG payment details).
export async function GET() {
  const settings = await getSiteSettings();
  return Response.json({
    tngPhone: settings.tng_phone ?? "",
    tngQrUrl: settings.tng_qr_url ?? "",
    depositRequired: settings.depositRequired ?? false,
    orderExpiryMinutes: settings.orderExpiryMinutes ?? 240,
  });
}
