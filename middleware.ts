import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";
import { verifyAdminToken, COOKIE_NAME, verifyKdsToken, KDS_COOKIE_NAME } from "./src/lib/auth";
import { getSiteSettings } from "./src/lib/site-settings";

export const runtime = "nodejs";

const intlMiddleware = createMiddleware(routing);

function buildCspHeader(nonce: string): string {
  const devFrameSrc =
    process.env.NODE_ENV !== "production" ? " http://localhost:3002" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `frame-src 'self' https://www.google.com https://maps.google.com${devFrameSrc}`,
    "connect-src 'self'",
    "worker-src 'self'",
  ].join("; ");
}

function applyCspHeaders(response: NextResponse, nonce: string): NextResponse {
  const csp = buildCspHeader(nonce);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  // Forward nonce as a request header so server components can read it via headers()
  response.headers.set("x-middleware-request-x-nonce", nonce);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a cryptographically random nonce per request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isOpen =
      pathname === "/admin/login" ||
      pathname.startsWith("/api/admin/login") ||
      pathname.startsWith("/api/admin/logout");
    if (!isOpen) {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      const valid = token ? await verifyAdminToken(token) : false;
      if (!valid)
        return applyCspHeaders(
          NextResponse.redirect(new URL("/admin/login", request.url)),
          nonce
        );
    }
    return applyCspHeaders(NextResponse.next(), nonce);
  }

  if (pathname.startsWith("/kds") || pathname.startsWith("/api/kds")) {
    const isOpen =
      pathname === "/kds/login" ||
      pathname.startsWith("/api/kds/login");
    if (!isOpen) {
      const token = request.cookies.get(KDS_COOKIE_NAME)?.value;
      const valid = token ? await verifyKdsToken(token) : false;
      if (!valid) {
        if (pathname.startsWith("/api/kds")) {
          return applyCspHeaders(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
            nonce
          );
        }
        return applyCspHeaders(
          NextResponse.redirect(new URL("/kds/login", request.url)),
          nonce
        );
      }
    }
    return applyCspHeaders(NextResponse.next(), nonce);
  }

  // For root path, redirect to admin-configured default locale
  if (pathname === "/") {
    const { defaultLocale } = await getSiteSettings();
    const locale = ["en", "ms", "zh"].includes(defaultLocale) ? defaultLocale : "en";
    return applyCspHeaders(
      NextResponse.redirect(new URL(`/${locale}`, request.url)),
      nonce
    );
  }

  return applyCspHeaders(intlMiddleware(request), nonce);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/kds",
    "/kds/:path*",
    "/api/kds/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
