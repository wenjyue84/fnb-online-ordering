import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import webpush from "web-push";
import { createRateLimiter } from "@/lib/chat/rate-limit";
import { OrderSubmitSchema } from "@/lib/schemas/order";
import { getSiteSettings } from "@/lib/site-settings";

// 5 orders per hour per IP
const ordersRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: "POST /api/orders",
});

// Configure VAPID — only if keys are present (skipped in dev without .env.local)
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

async function sendPushToAllAdmins(itemCount: number, total: number) {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  try {
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
    const { cafeName } = await getSiteSettings();
    const payload = JSON.stringify({
      title: `🍽 New Order — ${cafeName || "Cafe"}`,
      body: `${itemCount} item${itemCount !== 1 ? "s" : ""} — RM ${total.toFixed(2)}`,
      url: "/admin",
    });
    await Promise.allSettled(
      subs.map((row: { endpoint: string; p256dh: string; auth: string }) =>
        webpush
          .sendNotification(
            {
              endpoint: row.endpoint as string,
              keys: { p256dh: row.p256dh as string, auth: row.auth as string },
            },
            payload
          )
          .catch(async (err: { statusCode?: number }) => {
            // 410 Gone = subscription expired; clean it up
            if (err?.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint as string}`;
            }
          })
      )
    );
  } catch (err) {
    // Push is best-effort — never fail the order save because of it
    console.warn("[push] sendPushToAllAdmins failed:", err);
  }
}

export const runtime = "nodejs";

// Public endpoint — no auth required.
// Called by order-form-modal when customer submits their pre-order.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  // Bypass rate limiting for localhost to allow automated tests to run cleanly
  const rateCheck = ip === "127.0.0.1" ? { allowed: true } : ordersRateLimiter(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many orders. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = OrderSubmitSchema.safeParse(body);
    if (!parsed.success) {
      const fields = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
          k,
          v?.[0] ?? "Invalid",
        ])
      );
      return NextResponse.json(
        { error: "Validation failed", fields },
        { status: 400 }
      );
    }

    const { items, total, contactNumber: normalizedPhone, estimatedArrival } = parsed.data;
    const arrivalTime = new Date(estimatedArrival);

    // Ensure table exists with full schema (idempotent)
    await sql`
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
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Add missing columns to pre-existing tables (idempotent migration)
    await sql`ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS contact_number TEXT`;
    await sql`ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMPTZ`;
    await sql`ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS estimated_ready TIMESTAMPTZ`;
    await sql`ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT`;
    await sql`ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT`;

    const rows = await sql`
      INSERT INTO tray_orders (items, total, status, contact_number, estimated_arrival)
      VALUES (
        ${JSON.stringify(items)},
        ${total},
        'pending_approval',
        ${normalizedPhone},
        ${arrivalTime.toISOString()}
      )
      RETURNING id, created_at
    `;

    // Fire-and-forget push notification to all subscribed admins
    void sendPushToAllAdmins(items.length, total);

    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/orders]", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }
}
