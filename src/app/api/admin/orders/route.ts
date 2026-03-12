import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { createErrorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

// Protected by middleware — only reachable with a valid admin session.
export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        items,
        total,
        status,
        contact_number,
        estimated_arrival,
        estimated_ready,
        rejection_reason,
        payment_screenshot_url,
        notification_status,
        created_at
      FROM tray_orders
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/admin/orders]", err);
    return createErrorResponse("Failed to fetch orders", 500);
  }
}
