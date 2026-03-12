import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rainbowEnabled = process.env.RAINBOW_AI_ENABLED === "true";
  const rainbowUrl = process.env.RAINBOW_AI_URL;

  if (!rainbowEnabled || !rainbowUrl) {
    return NextResponse.json({ logged: false, reason: "Rainbow AI not enabled" });
  }

  try {
    const body = await request.json();
    const { message, aiResponse, sessionId, responseTime } = body;

    if (!message || !aiResponse) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fire-and-forget to Rainbow AI's webchat message endpoint
    // This logs the exchange in rainbow_messages for analytics
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(`${rainbowUrl}/api/chat/makan-moments/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: sessionId || "web_anonymous",
          history: [
            { role: "user", content: message },
            { role: "assistant", content: aiResponse },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    return NextResponse.json({ logged: true, responseTime });
  } catch (err) {
    console.warn("[chat/log] Failed to log to Rainbow AI:", err);
    return NextResponse.json({ logged: false });
  }
}
