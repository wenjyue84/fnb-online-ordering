import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { revalidateMenuCache } from "@/lib/cache-utils";

function revalidateMenu() {
  revalidateMenuCache();
}

export const runtime = "nodejs";

// GET /api/admin/display-categories/[id]/items — list items in a display category
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await sql`
    SELECT mi.id, mi.name_en, mi.code, mi.price, idc.sort_order
    FROM menu_items mi
    JOIN item_display_categories idc ON idc.item_id = mi.id
    WHERE idc.display_category_id = ${id}
    ORDER BY idc.sort_order ASC, mi.sort_order ASC, mi.name_en ASC
  `;
  return NextResponse.json(rows);
}

// POST /api/admin/display-categories/[id]/items — assign an item to a display category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { itemId } = await request.json();

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  await sql`
    INSERT INTO item_display_categories (item_id, display_category_id)
    VALUES (${itemId}, ${id})
    ON CONFLICT DO NOTHING
  `;
  revalidateMenu();
  return NextResponse.json({ ok: true }, { status: 201 });
}

// PATCH /api/admin/display-categories/[id]/items — reorder items
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { itemIds } = await request.json() as { itemIds: string[] };

  if (!Array.isArray(itemIds)) {
    return NextResponse.json({ error: "itemIds must be an array" }, { status: 400 });
  }

  await Promise.all(
    itemIds.map((itemId, idx) =>
      sql`
        UPDATE item_display_categories
        SET sort_order = ${idx}
        WHERE item_id = ${itemId} AND display_category_id = ${id}
      `
    )
  );

  revalidateMenu();
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/display-categories/[id]/items?itemId=... — remove an item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  await sql`
    DELETE FROM item_display_categories
    WHERE item_id = ${itemId} AND display_category_id = ${id}
  `;
  revalidateMenu();
  return NextResponse.json({ ok: true });
}
