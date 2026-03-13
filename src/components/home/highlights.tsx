import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { MenuItem } from "@/types/menu";
import { MenuCard } from "@/components/menu/menu-card";

interface HighlightsProps {
  items: MenuItem[];
  highlightsTitle?: string;
  highlightsSubtitle?: string;
}

export async function Highlights({ items, highlightsTitle, highlightsSubtitle }: HighlightsProps) {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  if (items.length === 0) return null;

  const title = highlightsTitle || t("highlightsTitle");
  const subtitle = highlightsSubtitle || t("highlightsSubtitle");

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="mb-4 sm:mb-8">
        <h2 className="font-display text-3xl font-bold">{title}</h2>
        <p className="mt-2 hidden text-muted-foreground sm:block">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {items.slice(0, 6).map((item, index) => (
          <div
            key={item.id}
            className="animate-fade-up"
            style={{ "--delay": `${index * 60}ms` } as CSSProperties}
          >
            <MenuCard item={item} priority={index < 2} />
          </div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {tc("viewMenu")}
        </Link>
      </div>
    </section>
  );
}
