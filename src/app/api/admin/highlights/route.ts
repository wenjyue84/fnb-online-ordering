import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { createErrorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

// GET /api/admin/highlights — returns { [category]: item_id }
export async function GET() {
  const rows = await sql`SELECT category, item_id FROM category_highlights`;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.category as string] = row.item_id as string;
  }
  return NextResponse.json(result);
}

// POST /api/admin/highlights — body: { category, itemId }
export async function POST(request: NextRequest) {
  const body = await request.json() as { category?: string; itemId?: string };
  const { category, itemId } = body;
  if (!category || !itemId) {
    return createErrorResponse("category and itemId required", 400);
  }
  await sql`
    INSERT INTO category_highlights (category, item_id)
    VALUES (${category}, ${itemId})
    ON CONFLICT (category) DO UPDATE SET item_id = EXCLUDED.item_id
  `;
  return NextResponse.json({ ok: true, category, itemId });
}

// DELETE /api/admin/highlights — body: { category }
export async function DELETE(request: NextRequest) {
  const body = await request.json() as { category?: string };
  const { category } = body;
  if (!category) {
    return createErrorResponse("category required", 400);
  }
  await sql`DELETE FROM category_highlights WHERE category = ${category}`;
  return NextResponse.json({ ok: true, category });
}
