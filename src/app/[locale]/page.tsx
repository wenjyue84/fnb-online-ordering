import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFeaturedItems, getSignatureDish } from "@/lib/menu";
import { HeroSection } from "@/components/home/hero-section";
import { Highlights } from "@/components/home/highlights";
import { PreorderBanner } from "@/components/home/preorder-banner";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import type { HomeContent } from "@/components/admin/home-inline-editor";
import dynamic from "next/dynamic";
const HomeInlineEditor = dynamic(() => import("@/components/admin/home-inline-editor").then(m => m.HomeInlineEditor));
import { getSiteSettings } from "@/lib/site-settings";
import { FadeUp } from "@/components/ui/fade-up";

export const revalidate = 3600;
export const runtime = "nodejs";

const HOME_FILE = path.join(process.cwd(), "content", "home.md");

function readHomeContent(fallback: HomeContent): HomeContent {
  if (!fs.existsSync(HOME_FILE)) return fallback;
  const raw = fs.readFileSync(HOME_FILE, "utf-8");
  const { data } = matter(raw);
  return {
    heroTitle: String(data.heroTitle || fallback.heroTitle),
    heroTagline: String(data.heroTagline || fallback.heroTagline),
    heroSubtitle: String(data.heroSubtitle || fallback.heroSubtitle),
    highlightsTitle: String(data.highlightsTitle || fallback.highlightsTitle),
    highlightsSubtitle: String(data.highlightsSubtitle || fallback.highlightsSubtitle),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const settings = await getSiteSettings();

  const fallback: HomeContent = {
    heroTitle: t("heroTitle"),
    heroTagline: settings.cafeTagline,
    heroSubtitle: t("heroSubtitle"),
    highlightsTitle: t("highlightsTitle"),
    highlightsSubtitle: t("highlightsSubtitle"),
  };

  const content = readHomeContent(fallback);

  const [cookieStore, signatureDish] = await Promise.all([
    cookies(),
    getSignatureDish(),
  ]);
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  if (isAdmin) {
    const featured = await getFeaturedItems();
    return <HomeInlineEditor content={content} featuredItems={featured} signatureDish={signatureDish} />;
  }

  return (
    <>
      <HeroSection
        heroTitle={content.heroTitle}
        heroTagline={content.heroTagline}
        heroSubtitle={content.heroSubtitle}
        signatureDish={signatureDish}
      />
      <FadeUp>
        <PreorderBanner />
      </FadeUp>
      <Suspense fallback={<HighlightsSkeleton />}>
        <FadeUp delay={100}>
          <HighlightsWithData
            highlightsTitle={content.highlightsTitle}
            highlightsSubtitle={content.highlightsSubtitle}
          />
        </FadeUp>
      </Suspense>
    </>
  );
}

async function HighlightsWithData({
  highlightsTitle,
  highlightsSubtitle,
}: {
  highlightsTitle: string;
  highlightsSubtitle: string;
}) {
  const featured = await getFeaturedItems();
  return (
    <Highlights
      items={featured}
      highlightsTitle={highlightsTitle}
      highlightsSubtitle={highlightsSubtitle}
    />
  );
}

function HighlightsSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="mb-4 sm:mb-8">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 hidden h-5 w-96 animate-pulse rounded bg-muted sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border">
            <div className="aspect-[4/3] animate-pulse bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
