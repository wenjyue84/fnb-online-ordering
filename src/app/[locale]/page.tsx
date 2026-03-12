import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getFeaturedItems, getSignatureDish } from "@/lib/menu";
import { HeroSection } from "@/components/home/hero-section";
import { Highlights } from "@/components/home/highlights";
import { PreorderBanner } from "@/components/home/preorder-banner";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { HomeInlineEditor, type HomeContent } from "@/components/admin/home-inline-editor";
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

  const [cookieStore, featured, signatureDish] = await Promise.all([
    cookies(),
    getFeaturedItems(),
    getSignatureDish(),
  ]);
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  if (isAdmin) {
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
      <FadeUp delay={100}>
        <Highlights
          items={featured}
          highlightsTitle={content.highlightsTitle}
          highlightsSubtitle={content.highlightsSubtitle}
        />
      </FadeUp>
    </>
  );
}
