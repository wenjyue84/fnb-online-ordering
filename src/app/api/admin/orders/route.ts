import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { createErrorResponse } from "@/lib/api-response";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

// Protected by middleware — only reachable with a valid admin session.
export async function GET() {
  try {
    // Lazy expiry: auto-expire stale pending_approval orders before fetching
    const { orderExpiryMinutes } = await getSiteSettings();
    await sql`
      UPDATE tray_orders
      SET status = 'expired'
      WHERE status = 'pending_approval'
        AND created_at < NOW() - MAKE_INTERVAL(mins => ${orderExpiryMinutes})
    `;

    // Ensure feedme_entered column exists (idempotent migration)
    await sql`
      ALTER TABLE tray_orders
      ADD COLUMN IF NOT EXISTS feedme_entered BOOLEAN DEFAULT FALSE
    `;

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
        feedme_entered,
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
