import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { revalidateMenuCache } from "@/lib/cache-utils";
import { invalidateSystemPromptCache } from "@/lib/chat/system-prompt";

export async function POST() {
  const rows = await sql`
    UPDATE menu_items SET available = true, updated_at = now()
    WHERE available = false
    RETURNING id
  `;

  revalidateMenuCache();
  invalidateSystemPromptCache();

  return NextResponse.json({ restored: rows.length });
}
