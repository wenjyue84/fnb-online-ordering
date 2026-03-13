import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { createErrorResponse } from "@/lib/api-response";
import { revalidateMenuCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

export async function GET() {
  // Migration: ensure allergens column exists
  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]'::jsonb`;
  const rows = await sql`SELECT * FROM menu_items ORDER BY sort_order ASC, name_en ASC`;
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    code,
    nameEn,
    nameMs = "",
    nameZh = "",
    price,
    description = "",
    dietary = [],
    categories = [],
    available = true,
    featured = false,
    sortOrder = 0,
    availableDays = [],
    timeFrom = "",
    timeUntil = "",
    specialDates = [],
    allergens = [],
  } = body;

  if (!code || !nameEn || price == null) {
    return createErrorResponse("code, nameEn, and price are required", 400);
  }

  const rows = await sql`
    INSERT INTO menu_items
      (code, name_en, name_ms, name_zh, price, description, dietary, categories,
       available, featured, sort_order, available_days, time_from, time_until, special_dates, allergens)
    VALUES
      (${code}, ${nameEn}, ${nameMs}, ${nameZh}, ${price}, ${description},
       ${dietary}, ${categories}, ${available}, ${featured}, ${sortOrder},
       ${availableDays}, ${timeFrom}, ${timeUntil}, ${specialDates}, ${allergens})
    RETURNING *
  `;
  revalidateMenuCache();
  return NextResponse.json(rows[0], { status: 201 });
}
