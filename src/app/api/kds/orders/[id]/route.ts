import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";

// PATCH /api/kds/orders/:id — update order status from KDS
// action: 'start' (approved → preparing) | 'ready' (preparing → ready)
// Protected by middleware (KDS session cookie required).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const body = (await request.json()) as { action?: string };
    const { action } = body;

    if (action === "start") {
      const rows = await sql`
        UPDATE tray_orders
        SET status = 'preparing'
        WHERE id = ${orderId} AND status = 'approved'
        RETURNING id, status
      `;
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Order not found or not in approved state" },
          { status: 404 }
        );
      }
      return NextResponse.json(rows[0]);
    }

    if (action === "ready") {
      const rows = await sql`
        UPDATE tray_orders
        SET status = 'ready'
        WHERE id = ${orderId} AND status = 'preparing'
        RETURNING id, status
      `;
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Order not found or not in preparing state" },
          { status: 404 }
        );
      }
      return NextResponse.json(rows[0]);
    }

    return NextResponse.json(
      { error: "action must be 'start' or 'ready'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[PATCH /api/kds/orders/[id]]", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
