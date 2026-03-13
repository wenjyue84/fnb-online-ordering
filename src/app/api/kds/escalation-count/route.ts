import { type NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";

// GET /api/kds/escalation-count?em=10
// Protected by KDS auth via middleware.
// Returns count of pending_approval orders overdue by > escalationMinutes.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const em = Math.max(1, Number(url.searchParams.get("em") || "10"));

  try {
    const rows = await sql`
      SELECT id, created_at
      FROM tray_orders
      WHERE status = 'pending_approval'
        AND created_at < NOW() - (${em} * INTERVAL '1 minute')
      ORDER BY created_at ASC
    `;

    const now = Date.now();
    const orders = rows.map((r: { id: number; created_at: string }) => ({
      id: r.id,
      minutesOverdue: Math.floor((now - new Date(r.created_at).getTime()) / 60_000) - em,
    }));

    return NextResponse.json({ count: orders.length, orders });
  } catch (err) {
    console.error("[GET /api/kds/escalation-count]", err);
    return NextResponse.json({ count: 0, orders: [] });
  }
}
