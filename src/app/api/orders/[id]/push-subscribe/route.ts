import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";

// POST /api/orders/[id]/push-subscribe
// Stores a customer push subscription for the given order.
// No auth — order ID is the identity (short public ID, not guessable in bulk).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const body = await request.json() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    const { endpoint, keys } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "endpoint, keys.p256dh, and keys.auth are required" }, { status: 400 });
    }

    // CREATE TABLE IF NOT EXISTS on first call
    await sql`
      CREATE TABLE IF NOT EXISTS order_push_subscriptions (
        id         SERIAL PRIMARY KEY,
        order_id   TEXT NOT NULL,
        endpoint   TEXT NOT NULL UNIQUE,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Upsert — same endpoint can be re-registered without error
    await sql`
      INSERT INTO order_push_subscriptions (order_id, endpoint, p256dh, auth)
      VALUES (${orderId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE
        SET order_id = EXCLUDED.order_id,
            p256dh   = EXCLUDED.p256dh,
            auth     = EXCLUDED.auth
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/orders/[id]/push-subscribe]", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
