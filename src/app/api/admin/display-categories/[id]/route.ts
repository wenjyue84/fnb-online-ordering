import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { revalidateMenuCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

// PATCH /api/admin/display-categories/[id] — update name or sort_order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, sortOrder, active } = await request.json();

  const rows = await sql`
    UPDATE display_categories SET
      name       = COALESCE(${name ?? null}, name),
      sort_order = COALESCE(${sortOrder ?? null}, sort_order),
      active     = COALESCE(${active ?? null}, active)
    WHERE id = ${id}
    RETURNING *
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateMenuCache();
  return NextResponse.json(rows[0]);
}

// DELETE /api/admin/display-categories/[id] — delete display category + junction rows
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Junction rows cascade-deleted via FK, but being explicit
  await sql`DELETE FROM item_display_categories WHERE display_category_id = ${id}`;
  await sql`DELETE FROM display_categories WHERE id = ${id}`;

  revalidateMenuCache();
  return NextResponse.json({ ok: true });
}
