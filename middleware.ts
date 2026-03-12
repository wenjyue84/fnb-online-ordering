import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";
import { verifyAdminToken, COOKIE_NAME, verifyKdsToken, KDS_COOKIE_NAME } from "./src/lib/auth";
import { getSiteSettings } from "./src/lib/site-settings";

export const runtime = "nodejs";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isOpen =
      pathname === "/admin/login" ||
      pathname.startsWith("/api/admin/login") ||
      pathname.startsWith("/api/admin/logout");
    if (!isOpen) {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      const valid = token ? await verifyAdminToken(token) : false;
      if (!valid)
        return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
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
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/kds/login", request.url));
      }
    }
    return NextResponse.next();
  }

  // For root path, redirect to admin-configured default locale
  if (pathname === "/") {
    const { defaultLocale } = await getSiteSettings();
    const locale = ["en", "ms", "zh"].includes(defaultLocale) ? defaultLocale : "en";
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return intlMiddleware(request);
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
