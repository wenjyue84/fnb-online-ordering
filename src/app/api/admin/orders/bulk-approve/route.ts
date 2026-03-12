import { type NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { calculateSmartReadyTime } from "@/lib/orders";

export const runtime = "nodejs";

async function checkAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

// POST /api/admin/orders/bulk-approve
// Approves all pending_approval orders with smart estimated-ready times.
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getSiteSettings();
    const newStatus = settings.depositRequired ? "approved" : "preparing";

    // Fetch all pending orders
    const pending = await sql<{ id: number; items: { quantity: number }[] }>`
      SELECT id, items FROM tray_orders WHERE status = 'pending_approval'
    `;

    if (pending.length === 0) {
      return NextResponse.json({ approved: 0, failed: 0 });
    }

    // Approve each in parallel, tolerating individual failures
    const results = await Promise.allSettled(
      pending.map(async (order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const readyTime = calculateSmartReadyTime(items);
        await sql`
          UPDATE tray_orders
          SET status = ${newStatus}, estimated_ready = ${readyTime.toISOString()}
          WHERE id = ${order.id}
        `;
        return order.id;
      })
    );

    const approved = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ approved, failed });
  } catch (err) {
    console.error("[POST /api/admin/orders/bulk-approve]", err);
    return NextResponse.json({ error: "Bulk approve failed" }, { status: 500 });
  }
}
