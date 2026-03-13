import { NextResponse, type NextRequest } from "next/server";
import { signKdsToken, KDS_COOKIE_NAME } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";

// In-memory rate limiting: 5 failed attempts per IP → 60s lockout
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const now = Date.now();
  const record = failedAttempts.get(ip);

  // Check lockout
  if (record && now < record.resetAt && record.count >= 5) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 60 seconds." },
      { status: 429 }
    );
  }

  const body = await request.json() as { pin?: string };
  const { pin } = body;

  const settings = await getSiteSettings();
  const correctPin = settings.kitchenPin ?? "1234";

  if (!pin || pin !== correctPin) {
    // Record failure
    if (!record || now >= record.resetAt) {
      failedAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    } else {
      failedAttempts.set(ip, { count: record.count + 1, resetAt: record.resetAt });
    }
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  // Success — clear fail record
  failedAttempts.delete(ip);

  const token = await signKdsToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(KDS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12, // 12 hours
    path: "/",
  });
  return response;
}
