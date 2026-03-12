import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMenuItems, getAllMenuItemsWithRulesForAdmin, getDisplayCategories } from "@/lib/menu";
import { getHighlightsFromDB, computeEffectiveHighlights } from "@/lib/highlights";
import { MenuGrid } from "@/components/menu/menu-grid";
import { MenuPageJsonLd } from "@/components/seo/json-ld";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { getServingNowCategories, getMalaysiaTimeString } from "@/lib/time-slots";
import { AdminPreviewBanner } from "@/components/menu/admin-preview-banner";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "menu" });
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ previewTime?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  const resolvedParams = await searchParams;
  // previewTime is admin-only; strip it for customers
  const previewTime = isAdmin ? (resolvedParams.previewTime ?? null) : null;
  const initialSearch = resolvedParams.q ?? "";

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {isAdmin && (
          <Suspense fallback={null}>
            <AdminPreviewBanner currentTime={getMalaysiaTimeString()} previewTime={previewTime} />
          </Suspense>
        )}
        <MenuPageHeader />
        <Suspense fallback={<MenuGridSkeleton />}>
          <MenuContent
            locale={locale}
            nonce={nonce}
            isAdmin={isAdmin}
            previewTime={previewTime}
            initialSearch={initialSearch}
          />
        </Suspense>
      </div>
    </>
  );
}

async function MenuContent({
  locale,
  nonce,
  isAdmin,
  previewTime,
  initialSearch,
}: {
  locale: string;
  nonce: string | undefined;
  isAdmin: boolean;
  previewTime: string | null;
  initialSearch: string;
}) {
  const [items, displayCats, persistedHighlights] = await Promise.all([
    isAdmin ? getAllMenuItemsWithRulesForAdmin() : getMenuItems(),
    getDisplayCategories(),
    getHighlightsFromDB(),
  ]);

  const highlightedByCategory = computeEffectiveHighlights(items, persistedHighlights);
  const activeDisplayCats = displayCats.filter((dc) => dc.active);
  const displayCategoryNames = activeDisplayCats.map((dc) => dc.name);
  const chefsCat = activeDisplayCats.find((dc) => dc.name.toLowerCase().includes("chef"));
  const chefsCatId = chefsCat?.id?.toString() ?? null;
  const initialCategory: string | null = null;
  const servingNowCategories = await getServingNowCategories(previewTime);

  return (
    <>
      <MenuPageJsonLd nonce={nonce} items={items} locale={locale} />
      <MenuGrid
        items={items}
        displayCategories={displayCategoryNames}
        isAdmin={isAdmin}
        highlightedByCategory={highlightedByCategory}
        initialCategory={initialCategory}
        initialSearch={initialSearch}
        servingNowCategories={servingNowCategories}
        previewTime={previewTime}
        chefsCatId={chefsCatId}
      />
    </>
  );
}

async function MenuPageHeader() {
  const t = await getTranslations("menu");
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}

function MenuGridSkeleton() {
  return (
    <>
      {/* Filter bar skeleton */}
      <div className="sticky top-[60px] z-30 bg-background pb-3">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-muted"
            />
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border"
          >
            <div className="aspect-[4/3] animate-pulse bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
