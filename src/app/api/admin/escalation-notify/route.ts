import { type NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import webpush from "web-push";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Ensure escalation_notified_at column exists (idempotent migration)
async function ensureColumn() {
  try {
    await sql`ALTER TABLE tray_orders ADD COLUMN IF NOT EXISTS escalation_notified_at TIMESTAMPTZ`;
  } catch {
    // Column may already exist — ignore
  }
}

let columnEnsured = false;

// POST /api/admin/escalation-notify
// Called from admin-orders-bell when SSE escalation event is received.
// Sends urgent push to all admin subscriptions — deduplicates via DB column.
export async function POST(request: NextRequest) {
  if (!columnEnsured) {
    await ensureColumn();
    columnEnsured = true;
  }

  try {
    const body = await request.json() as { orderId?: unknown };
    const orderId = body.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    // Atomic deduplication: only notify if escalation_notified_at is still NULL
    const updated = await sql`
      UPDATE tray_orders
      SET escalation_notified_at = NOW()
      WHERE id = ${orderId as string}
        AND escalation_notified_at IS NULL
        AND status = 'pending_approval'
      RETURNING id
    `;

    if (updated.length === 0) {
      // Already notified or order no longer pending — skip push
      return NextResponse.json({ sent: false, reason: "already_notified_or_resolved" });
    }

    // Send push to all admin subscriptions
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ sent: false, reason: "vapid_not_configured" });
    }

    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>`
      SELECT endpoint, p256dh, auth FROM push_subscriptions
    `;

    const { cafeName } = await getSiteSettings();
    const payload = JSON.stringify({
      title: `⚠️ Urgent: Order Overdue — ${cafeName || "Cafe"}`,
      body: `Order #${String(orderId)} has been waiting 10+ minutes for approval`,
      url: "/admin",
      tag: `escalation-${String(orderId)}`,
      priority: "urgent",
    });

    await Promise.allSettled(
      subs.map((row) =>
        webpush
          .sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            payload
          )
          .catch(async (err: { statusCode?: number }) => {
            if (err?.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`;
            }
          })
      )
    );

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[POST /api/admin/escalation-notify]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
