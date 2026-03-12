import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, code, name_en, price
      FROM menu_items
      WHERE available = true AND (archived IS NULL OR archived = false)
      ORDER BY sort_order ASC
    `;

    const items = rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name_en as string,
      price: Number(r.price),
    }));

    return NextResponse.json(items, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("[api/menu] Error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
