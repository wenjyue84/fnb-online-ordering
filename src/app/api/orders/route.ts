import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import webpush from "web-push";
import { createRateLimiter } from "@/lib/chat/rate-limit";
import { OrderSubmitSchema } from "@/lib/schemas/order";
import { getSiteSettings } from "@/lib/site-settings";
import { sendOrderWhatsAppNotification } from "@/lib/notifications";

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
  const rateCheck = await ordersRateLimiter(ip);
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

    // Slot capacity check: count orders in the same 30-minute window
    const settings = await getSiteSettings();

    // Configurable minimum advance time check
    const minAdvanceMs = (settings.minAdvanceMinutes ?? 15) * 60 * 1000;
    if (arrivalTime.getTime() - Date.now() < minAdvanceMs) {
      return NextResponse.json(
        { error: "arrival_too_soon", minAdvanceMinutes: settings.minAdvanceMinutes ?? 15 },
        { status: 400 }
      );
    }
    const maxPerSlot = settings.maxOrdersPerSlot ?? 5;

    // Compute slot boundaries (floor to :00 or :30)
    const slotStartMs = Math.floor(arrivalTime.getTime() / (30 * 60_000)) * (30 * 60_000);
    const slotStart = new Date(slotStartMs);
    const slotEnd = new Date(slotStartMs + 30 * 60_000);

    const countRows = await sql<{ count: string }>`
      SELECT COUNT(*) AS count
      FROM tray_orders
      WHERE estimated_arrival >= ${slotStart.toISOString()}
        AND estimated_arrival < ${slotEnd.toISOString()}
        AND status NOT IN ('rejected', 'expired')
    `;
    const slotCount = parseInt(countRows[0]?.count ?? "0", 10);

    if (slotCount >= maxPerSlot) {
      // Find the next available slot
      let nextSlotStart = slotEnd;
      let nextSlotEnd = new Date(nextSlotStart.getTime() + 30 * 60_000);
      for (let i = 0; i < 24; i++) {
        const checkRows = await sql<{ count: string }>`
          SELECT COUNT(*) AS count
          FROM tray_orders
          WHERE estimated_arrival >= ${nextSlotStart.toISOString()}
            AND estimated_arrival < ${nextSlotEnd.toISOString()}
            AND status NOT IN ('rejected', 'expired')
        `;
        const checkCount = parseInt(checkRows[0]?.count ?? "0", 10);
        if (checkCount < maxPerSlot) break;
        nextSlotStart = nextSlotEnd;
        nextSlotEnd = new Date(nextSlotStart.getTime() + 30 * 60_000);
      }
      return NextResponse.json(
        { error: "slot_full", nextAvailableSlot: nextSlotStart.toISOString() },
        { status: 409 }
      );
    }

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

    const orderId = rows[0].id as number;

    // Fire-and-forget push notification to all subscribed admins
    void sendPushToAllAdmins(items.length, total);

    // Fire-and-forget WhatsApp notification with retry (updates notification_status in DB)
    void sendOrderWhatsAppNotification({
      orderId,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total,
      contactNumber: normalizedPhone,
      estimatedArrival: arrivalTime.toISOString(),
    }, settings.waiterEmail);

    return NextResponse.json({ ok: true, id: orderId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/orders]", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }
}
