"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const ALLERGEN_LIST = ["nuts", "shellfish", "dairy", "eggs", "gluten", "soy"] as const;
export type AllergenSlug = (typeof ALLERGEN_LIST)[number];

const ALLERGEN_CONFIG: Record<AllergenSlug, { emoji: string; bg: string; text: string; border: string }> = {
  nuts: { emoji: "🥜", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  shellfish: { emoji: "🦐", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  dairy: { emoji: "🥛", bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  eggs: { emoji: "🥚", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  gluten: { emoji: "🌾", bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-800 dark:text-lime-300", border: "border-lime-200 dark:border-lime-800" },
  soy: { emoji: "🫘", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
};

interface AllergenBadgeProps {
  allergen: string;
  showLabel?: boolean;
}

export function AllergenBadge({ allergen, showLabel = false }: AllergenBadgeProps) {
  const t = useTranslations("allergens");
  const [showTooltip, setShowTooltip] = useState(false);
  const slug = allergen.toLowerCase() as AllergenSlug;
  const config = ALLERGEN_CONFIG[slug];
  if (!config) return null;

  const label = t(slug);

  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium cursor-default select-none",
        config.bg,
        config.text,
        config.border
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip((v) => !v)}
      role="img"
      aria-label={`${t("contains")} ${label}`}
    >
      <span aria-hidden="true">{config.emoji}</span>
      {showLabel && <span>{label}</span>}
      {showTooltip && !showLabel && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] font-medium text-background shadow-lg z-50 pointer-events-none">
          {label}
        </span>
      )}
    </span>
  );
}

interface AllergenBadgesProps {
  allergens: string[];
  showLabels?: boolean;
}

export function AllergenBadges({ allergens, showLabels = false }: AllergenBadgesProps) {
  if (!allergens || allergens.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {allergens.map((a) => (
        <AllergenBadge key={a} allergen={a} showLabel={showLabels} />
      ))}
    </div>
  );
}
