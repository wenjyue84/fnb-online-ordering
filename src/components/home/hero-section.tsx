import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { HERO_BLUR } from "@/data/hero-blur";
import { getSiteSettings } from "@/lib/site-settings";
import type { MenuItem } from "@/types/menu";
import { HeroDishCard } from "@/components/home/hero-dish-card";

interface HeroSectionProps {
  heroTitle?: string;
  heroTagline?: string;
  heroSubtitle?: string;
  signatureDish?: MenuItem | null;
}

export async function HeroSection({ heroTitle, heroTagline, heroSubtitle, signatureDish }: HeroSectionProps = {}) {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const settings = await getSiteSettings();

  const title = heroTitle || t("heroTitle");
  const tagline = heroTagline || settings.cafeTagline;
  const subtitle = heroSubtitle || t("heroSubtitle");

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/8 via-background to-accent/15">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:py-16 lg:py-24">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">

          {/* Mobile hero image — FIRST so food is above the fold on mobile. No fade-in: LCP element must be immediately visible */}
          <div className="lg:hidden">
            <HeroDishCard
              item={signatureDish ?? null}
              cafeName={settings.cafeName}
              className="aspect-[2/1] shadow-2xl"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
              priority
              fallbackBlurDataURL={HERO_BLUR.heroMobile}
            />
          </div>

          {/* Text — /bolder: much larger h1, Playfair Display, italic tagline */}
          <div>
            {/* /delight: Tagline badge above h1 */}
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary animate-fade-in"
              style={{ "--delay": "0ms" } as CSSProperties}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {settings.neighborhood}
            </div>

            <h1
              className="font-display text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl animate-fade-up"
              style={{ "--delay": "80ms" } as CSSProperties}
            >
              <span className="text-primary">{title}</span>
            </h1>

            {/* /bolder: Italic tagline with Playfair Display */}
            <p
              className="mt-2 font-display text-base italic text-primary/75 sm:text-lg animate-fade-up"
              style={{ "--delay": "160ms" } as CSSProperties}
            >
              {tagline}
            </p>

            <p
              className="mt-2 hidden text-sm leading-6 text-muted-foreground sm:mt-5 sm:block sm:text-lg sm:leading-8 animate-fade-up"
              style={{ "--delay": "240ms" } as CSSProperties}
            >
              {subtitle}
            </p>

            {/* Halal-Friendly badge — visible above the fold on mobile */}
            <div
              className="mt-3 animate-fade-up"
              style={{ "--delay": "280ms" } as CSSProperties}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
                title={tc("halalTooltip")}
                aria-label={`${tc("halalBadge")}: ${tc("halalTooltip")}`}
              >
                <span aria-hidden="true">🌙</span>
                {tc("halalBadge")}
              </span>
            </div>

            <div
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap animate-fade-up"
              style={{ "--delay": "320ms" } as CSSProperties}
            >
              <Link href="/menu" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-h-[52px] rounded-xl text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-md"
                >
                  {tc("viewMenu")}
                </Button>
              </Link>
              <Link href="/contact" className="hidden sm:inline-flex">
                <Button
                  variant="outline"
                  size="lg"
                  className="min-h-[48px] border-primary/40 text-base font-medium text-primary hover:bg-primary/8 hover:text-primary transition-colors"
                >
                  {tc("orderNow")}
                </Button>
              </Link>
            </div>

            {/* /delight: Dietary trust badges — hidden on mobile to keep CTA above fold */}
            <div
              className="mt-4 hidden flex-wrap gap-2 sm:flex animate-fade-in"
              style={{ "--delay": "400ms" } as CSSProperties}
            >
              {settings.dietary.map((d) => (
                <span key={d} className="text-xs text-muted-foreground">
                  ✓ {d}
                </span>
              ))}
            </div>
          </div>

          {/* Desktop hero image — /bolder + /delight: hover lift */}
          <div className="relative hidden w-full lg:block lg:pl-8">
            <HeroDishCard
              item={signatureDish ?? null}
              cafeName={settings.cafeName}
              className="aspect-[4/3] shadow-xl hover-lift"
              sizes="(max-width: 1024px) 50vw, 800px"
              fallbackBlurDataURL={HERO_BLUR.heroMobile}
            />
          </div>
        </div>
      </div>

      {/* /delight: Decorative gradient orbs — desktop only */}
      <div className="pointer-events-none absolute -right-20 -top-20 hidden h-80 w-80 rounded-full bg-primary/8 blur-3xl lg:block" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 hidden h-56 w-56 rounded-full bg-accent/25 blur-3xl lg:block" />
    </section>
  );
}
