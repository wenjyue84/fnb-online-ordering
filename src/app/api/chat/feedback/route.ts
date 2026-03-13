import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageIndex, rating, sessionId } = body;

    if (typeof messageIndex !== "number" || !["up", "down"].includes(rating)) {
      return NextResponse.json({ error: "Invalid feedback data" }, { status: 400 });
    }

    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS chat_feedback (
        id SERIAL PRIMARY KEY,
        session_id TEXT,
        message_index INTEGER NOT NULL,
        rating TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO chat_feedback (session_id, message_index, rating)
      VALUES (${sessionId || null}, ${messageIndex}, ${rating})
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[chat/feedback] Error:", err);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
