import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { OrderPatchSchema } from "@/lib/schemas/order";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

// PATCH /api/admin/orders/:id  — mark order as 'seen'
// Protected by middleware — only reachable with a valid admin session.
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

    const body = await request.json();
    const parsed = OrderPatchSchema.safeParse(body);
    if (!parsed.success) {
      const fields = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
          k,
          v?.[0] ?? "Invalid",
        ])
      );
      return NextResponse.json(
        { error: "Validation failed", fields },
        { status: 422 }
      );
    }
    const { status, action, estimatedReady, rejectionReason } = parsed.data;

    // Legacy: mark as 'seen' (from bell notification)
    if (status === "seen") {
      const rows = await sql`
        UPDATE tray_orders SET status = 'seen' WHERE id = ${orderId} RETURNING id, status
      `;
      if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Approve order
    if (action === "approve") {
      const settings = await getSiteSettings();
      const newStatus = settings.depositRequired ? "approved" : "preparing";
      const readyAt = estimatedReady ? new Date(estimatedReady) : null;
      if (estimatedReady && readyAt && isNaN(readyAt.getTime())) {
        return NextResponse.json({ error: "estimatedReady is not a valid date" }, { status: 400 });
      }
      const rows = readyAt
        ? await sql`
            UPDATE tray_orders
            SET status = ${newStatus}, estimated_ready = ${readyAt.toISOString()}
            WHERE id = ${orderId}
            RETURNING id, status, estimated_ready
          `
        : await sql`
            UPDATE tray_orders
            SET status = ${newStatus}
            WHERE id = ${orderId}
            RETURNING id, status, estimated_ready
          `;
      if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Reject order
    if (action === "reject") {
      const reason = (rejectionReason ?? "").trim() || "Order was rejected";
      const rows = await sql`
        UPDATE tray_orders
        SET status = 'rejected', rejection_reason = ${reason}
        WHERE id = ${orderId}
        RETURNING id, status, rejection_reason
      `;
      if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Confirm payment — advance to 'preparing'
    if (action === "confirm_payment") {
      const rows = await sql`
        UPDATE tray_orders
        SET status = 'preparing'
        WHERE id = ${orderId}
        RETURNING id, status
      `;
      if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Reject payment — return to 'payment_pending'
    if (action === "reject_payment") {
      const note = (rejectionReason ?? "").trim() || "Payment not verified";
      const rows = await sql`
        UPDATE tray_orders
        SET status = 'payment_pending', rejection_reason = ${note}
        WHERE id = ${orderId}
        RETURNING id, status, rejection_reason
      `;
      if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Mark order ready
    if (action === "mark_ready") {
      const rows = await sql`
        UPDATE tray_orders
        SET status = 'ready'
        WHERE id = ${orderId}
        RETURNING id, status
      `;
      if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    return NextResponse.json(
      { error: "action must be 'approve', 'reject', 'confirm_payment', 'reject_payment', or 'mark_ready'; or status must be 'seen'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[PATCH /api/admin/orders/[id]]", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
