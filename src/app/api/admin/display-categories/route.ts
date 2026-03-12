import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { revalidateMenuCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

// GET /api/admin/display-categories — list all display categories
export async function GET() {
  const rows = await sql`
    SELECT dc.*, COUNT(idc.item_id)::int AS item_count
    FROM display_categories dc
    LEFT JOIN item_display_categories idc ON idc.display_category_id = dc.id
    GROUP BY dc.id
    ORDER BY dc.sort_order ASC, dc.name ASC
  `;
  return NextResponse.json(rows);
}

// POST /api/admin/display-categories — create a new display category
export async function POST(request: NextRequest) {
  const { name, sortOrder = 0 } = await request.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO display_categories (name, sort_order)
    VALUES (${name.trim()}, ${sortOrder})
    RETURNING *
  `;
  revalidateMenuCache();
  return NextResponse.json(rows[0], { status: 201 });
}
