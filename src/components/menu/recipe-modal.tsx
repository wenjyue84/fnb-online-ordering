"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { MenuItem } from "@/types/menu";
import { formatPrice, getLocalizedName } from "@/lib/utils";
import { DietaryBadge } from "./dietary-badge";
import { getRecipeInfo } from "@/data/recipe-info";

interface RecipeModalProps {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
}

export function RecipeModal({ item, open, onClose }: RecipeModalProps) {
  const locale = useLocale();
  const t = useTranslations("recipe");
  const name = getLocalizedName(item, locale);
  const recipe = getRecipeInfo(item.nameEn);
  const [imgError, setImgError] = useState(false);
  const hasPhoto = !!item.photo && !imgError;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — absolutely positioned outside the scroll container so it stays visible */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content area — button stays above this */}
        <div className="overflow-y-auto flex-1">
          {/* Food image */}
          {hasPhoto && (
            <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl">
              <Image
                src={item.photo!}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 512px"
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-4 p-5">
            {/* Title + price */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <h2 className="text-lg font-bold leading-snug">{name}</h2>
                {item.code && (
                  <span className="text-xs font-mono text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded self-start">
                    {item.code}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-base font-bold text-primary">
                {formatPrice(item.price)}
              </span>
            </div>

            {/* Dietary badges */}
            {item.dietary.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.dietary.map((d) => (
                  <DietaryBadge key={d} label={d} />
                ))}
              </div>
            )}

            {/* Short description */}
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}

            {/* Recipe info — only shown if data exists */}
            {recipe && (
              <>
                <hr className="border-border" />

                {/* Key ingredients */}
                {recipe.ingredients.length > 0 && (
                  <div>
                    <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                      <span aria-hidden="true">🌿</span>
                      {t("ingredients")}
                    </h3>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {recipe.ingredients.map((ing) => (
                        <li
                          key={ing}
                          className="flex items-start gap-1.5 text-sm text-muted-foreground"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* How we make it */}
                {recipe.preparation && (
                  <>
                    <hr className="border-border" />
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <span aria-hidden="true">👨‍🍳</span>
                        {t("preparation")}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {recipe.preparation}
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
