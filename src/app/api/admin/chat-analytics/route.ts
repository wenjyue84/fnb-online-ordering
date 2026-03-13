import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth";
import sql from "@/lib/db";

async function checkAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let summary: Array<{ rating: string; count: number }> = [];
    let recent: Array<{ id: number; session_id: string | null; message_index: number; rating: string; created_at: string }> = [];

    try {
      const summaryRows = await sql`
        SELECT rating, COUNT(*)::int as count
        FROM chat_feedback
        GROUP BY rating
      `;
      summary = summaryRows as typeof summary;

      const recentRows = await sql`
        SELECT id, session_id, message_index, rating, created_at
        FROM chat_feedback
        ORDER BY created_at DESC
        LIMIT 50
      `;
      recent = recentRows as typeof recent;
    } catch {
      // Table doesn't exist yet — return empty data
    }

    const upCount = summary.find((r) => r.rating === "up")?.count ?? 0;
    const downCount = summary.find((r) => r.rating === "down")?.count ?? 0;
    const total = upCount + downCount;

    return NextResponse.json({
      upCount,
      downCount,
      total,
      upPercent: total > 0 ? Math.round((upCount / total) * 100) : 0,
      recent,
    });
  } catch (err) {
    console.error("[admin/chat-analytics] Error:", err);
    return NextResponse.json({ upCount: 0, downCount: 0, total: 0, upPercent: 0, recent: [] });
  }
}
