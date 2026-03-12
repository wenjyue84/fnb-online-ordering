import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { createErrorResponse } from "@/lib/api-response";
import { revalidateMenuCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

export async function GET() {
  const rows = await sql`SELECT * FROM rules ORDER BY priority DESC, created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    name,
    ruleType,
    targetType,
    targetCategories = [],
    targetItemIds = [],
    excludeItemIds = [],
    value = 0,
    active = true,
    startsAt = null,
    endsAt = null,
    timeFrom = "",
    timeUntil = "",
    priority = 0,
  } = body;

  if (!name || !ruleType || !targetType) {
    return createErrorResponse("name, ruleType, and targetType are required", 400);
  }

  const rows = await sql`
    INSERT INTO rules
      (name, rule_type, target_type, target_categories, target_item_ids,
       exclude_item_ids, value, active, starts_at, ends_at, time_from, time_until, priority)
    VALUES
      (${name}, ${ruleType}, ${targetType}, ${targetCategories}, ${targetItemIds},
       ${excludeItemIds}, ${value}, ${active}, ${startsAt}, ${endsAt}, ${timeFrom}, ${timeUntil}, ${priority})
    RETURNING *
  `;
  revalidateMenuCache();
  return NextResponse.json(rows[0], { status: 201 });
}
