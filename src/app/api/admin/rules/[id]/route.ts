import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { revalidateMenuCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const {
    name,
    ruleType,
    targetType,
    targetCategories,
    targetItemIds,
    excludeItemIds,
    value,
    active,
    startsAt,
    endsAt,
    timeFrom,
    timeUntil,
    priority,
  } = body;

  const rows = await sql`
    UPDATE rules SET
      name              = COALESCE(${name ?? null}, name),
      rule_type         = COALESCE(${ruleType ?? null}, rule_type),
      target_type       = COALESCE(${targetType ?? null}, target_type),
      target_categories = COALESCE(${targetCategories ?? null}, target_categories),
      target_item_ids   = COALESCE(${targetItemIds ?? null}, target_item_ids),
      exclude_item_ids  = COALESCE(${excludeItemIds ?? null}, exclude_item_ids),
      value             = COALESCE(${value ?? null}, value),
      active            = COALESCE(${active ?? null}, active),
      starts_at         = COALESCE(${startsAt ?? null}, starts_at),
      ends_at           = COALESCE(${endsAt ?? null}, ends_at),
      time_from         = COALESCE(${timeFrom ?? null}, time_from),
      time_until        = COALESCE(${timeUntil ?? null}, time_until),
      priority          = COALESCE(${priority ?? null}, priority),
      updated_at        = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateMenuCache();
  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await sql`DELETE FROM rules WHERE id = ${id}`;
  revalidateMenuCache();
  return NextResponse.json({ ok: true });
}
