import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import sql from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await sql`SELECT id, code, name_en FROM menu_items WHERE available = true AND (archived IS NULL OR archived = false) ORDER BY sort_order ASC, name_en ASC`;

  const publicDir = join(process.cwd(), "public", "images", "menu");
  const missing = rows.filter((row: Record<string, unknown>) => {
    const code = row.code as string;
    return (
      !existsSync(join(publicDir, `${code}.jpg`)) &&
      !existsSync(join(publicDir, `${code}.webp`)) &&
      !existsSync(join(publicDir, `${code}.png`))
    );
  });

  return NextResponse.json(
    missing.map((r: Record<string, unknown>) => ({ id: r.id, code: r.code, nameEn: r.name_en }))
  );
}
