import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";

const GRACE_PERIOD_SECONDS = 120;

/**
 * POST /api/orders/[id]/cancel
 * Customer self-service cancellation within 2-minute grace period.
 * No auth required — the order ID (nanoid) is the implicit token.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // Fetch order to verify status and creation time
    const rows = await sql`
      SELECT id, status, created_at
      FROM tray_orders
      WHERE id = ${orderId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = rows[0];

    // Only pending_approval orders can be cancelled
    if (order.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Order can no longer be cancelled" },
        { status: 403 }
      );
    }

    // Check grace period: created_at + 120 seconds > NOW()
    const createdAt = new Date(order.created_at as string).getTime();
    const elapsed = Date.now() - createdAt;
    if (elapsed > GRACE_PERIOD_SECONDS * 1000) {
      return NextResponse.json(
        { error: "Cancellation window has expired" },
        { status: 403 }
      );
    }

    // Cancel the order
    await sql`
      UPDATE tray_orders
      SET status = 'cancelled'
      WHERE id = ${orderId} AND status = 'pending_approval'
    `;

    return NextResponse.json({ id: orderId, status: "cancelled" });
  } catch (err) {
    console.error("[POST /api/orders/[id]/cancel]", err);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
