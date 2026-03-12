import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

// Public endpoint — no auth required.
// Customers can poll their own order status using the ID returned by POST /api/orders.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, status, created_at
      FROM tray_orders
      WHERE id = ${orderId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const row = rows[0];
    const ageMs = Date.now() - new Date(row.created_at as string).getTime();
    const { orderExpiryMinutes } = await getSiteSettings();
    const expiryMs = orderExpiryMinutes * 60 * 1000;

    // Auto-expire pending_approval orders older than the configured threshold
    if (row.status === 'pending_approval' && ageMs > expiryMs) {
      await sql`UPDATE tray_orders SET status = 'expired' WHERE id = ${orderId}`;
      return NextResponse.json(
        { id: row.id, status: 'expired', createdAt: row.created_at },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Auto-expire approved orders with no payment after 30 minutes
    if (row.status === 'approved' && ageMs > 30 * 60 * 1000) {
      await sql`UPDATE tray_orders SET status = 'expired' WHERE id = ${orderId}`;
      return NextResponse.json(
        { id: row.id, status: 'expired', createdAt: row.created_at },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { id: row.id, status: row.status, createdAt: row.created_at },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/orders/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
