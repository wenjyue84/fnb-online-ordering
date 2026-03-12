import { type NextRequest } from "next/server";
import { getSiteSettings, writeSiteSettings } from "@/lib/site-settings";
import type { SiteSettings } from "@/lib/site-settings";
import { createErrorResponse } from "@/lib/api-response";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

async function checkAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return createErrorResponse("Unauthorized", 401);
  }
  return Response.json(await getSiteSettings());
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return createErrorResponse("Unauthorized", 401);
  }
  try {
    const body = (await req.json()) as Partial<SiteSettings>;
    const current = await getSiteSettings();

    const VALID_LOCALES = ["en", "ms", "zh"];
    if (body.defaultLocale && !VALID_LOCALES.includes(body.defaultLocale)) {
      return createErrorResponse("Invalid defaultLocale", 400);
    }

    const updated: SiteSettings = {
      ...current,
      ...body,
      operatingHours: {
        ...current.operatingHours,
        ...(body.operatingHours ?? {}),
      },
    };

    await writeSiteSettings(updated);
    return Response.json({ ok: true, settings: updated });
  } catch (err) {
    console.error("[settings] Failed to save:", err);
    return createErrorResponse("Failed to save settings", 500);
  }
}
