import { NextResponse, type NextRequest } from "next/server";
import { scryptSync, timingSafeEqual } from "crypto";
import { signAdminToken, COOKIE_NAME } from "@/lib/auth";
import { createRateLimiter } from "@/lib/chat/rate-limit";
import sql from "@/lib/db";

// Must use nodejs runtime — edge runtime does not support crypto or in-memory state
export const runtime = "nodejs";

// 10 attempts per 15 minutes per IP
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: "POST /api/admin/login",
});

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const hash = scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  const rateCheck = await loginRateLimiter(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) },
      }
    );
  }

  const { username, password } = await request.json();

  // Check credentials against admin_users table in Neon
  const rows = await sql<{ salt: string; password_hash: string }>`
    SELECT salt, password_hash
    FROM admin_users
    WHERE username = ${username}
    LIMIT 1
  `;

  const valid =
    rows.length > 0 && verifyPassword(password, rows[0].salt, rows[0].password_hash);

  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signAdminToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
  return response;
}
