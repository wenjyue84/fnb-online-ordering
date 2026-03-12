"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ZoomIn, Plus, Minus } from "lucide-react";
import { useLocale } from "next-intl";
import type { MenuItem } from "@/types/menu";
import { getRecipeInfo } from "@/data/recipe-info";
import { cn, getLocalizedName } from "@/lib/utils";
import { useTray } from "@/lib/tray-context";

interface HeroDishCardProps {
  item: MenuItem | null;
  /** Cafe name for alt text */
  cafeName?: string;
  /** Tailwind classes for the card wrapper — include aspect ratio and shadow here */
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** blurDataURL for the static fallback image (when item is null) */
  fallbackBlurDataURL?: string;
}

export function HeroDishCard({
  item,
  cafeName = "Cafe",
  className,
  sizes = "100vw",
  priority = false,
  fallbackBlurDataURL,
}: HeroDishCardProps) {
  const locale = useLocale();
  const { addItem, decrementItem, items } = useTray();
  const [panelOpen, setPanelOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const itemName = item ? getLocalizedName(item, locale) : "";
  const trayItem = item ? items.find((i) => i.id === item.code) : undefined;
  const isInTray = !!trayItem;

  const mainSrc = item ? (item.photo ?? `/images/menu/${item.code}.jpg`) : "/images/hero/hero-mobile.webp";
  const recipe = item ? getRecipeInfo(item.nameEn) : null;
  // Use the pre-computed photos array from the DB (primary + up to 2 secondary)
  const photos = item?.photos?.length ? item.photos : item ? [mainSrc] : [];

  const handleMouseEnter = useCallback(() => {
    if (item) setPanelOpen(true);
  }, [item]);

  const handleMouseLeave = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!item) return;
    if (panelOpen) {
      setLightboxOpen(true);
    } else {
      setPanelOpen(true);
    }
  }, [item, panelOpen]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setActiveImg(0);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox]);

  // Static fallback when no signature dish is set
  if (!item) {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-2xl", className)}>
        <Image
          src="/images/hero/hero-mobile.webp"
          alt={cafeName}
          fill
          className="object-cover img-scale"
          sizes={sizes}
          priority={priority}
          {...(fallbackBlurDataURL
            ? { placeholder: "blur" as const, blurDataURL: fallbackBlurDataURL }
            : {})}
        />
      </div>
    );
  }

  return (
    <>
      {/* Interactive card */}
      <div
        className={cn(
          "group relative w-full cursor-pointer overflow-hidden rounded-2xl",
          className,
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`${item.nameEn} — RM${item.price.toFixed(2)}. Tap to view details.`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
      >
        <Image
          src={mainSrc}
          alt={`${item.nameEn} — Signature dish at ${cafeName}`}
          fill
          className="object-cover img-scale"
          sizes={sizes}
          priority={priority}
          style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined}
        />
        {/* Permanent gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />

        {/* Slide-down info panel — revealed on hover (desktop) or first tap (mobile) */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 overflow-hidden transition-all duration-300 ease-in-out",
            panelOpen ? "max-h-28" : "max-h-0",
          )}
        >
          <div className="flex items-center justify-between bg-background/90 px-4 py-3 backdrop-blur-md">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.nameEn}</p>
              <p className="text-xs text-muted-foreground">RM {item.price.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(true);
                }}
                className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-background/80 text-foreground border border-border hover:bg-muted"
                aria-label="Open full view"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              {isInTray ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); decrementItem(item.code); }}
                    className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
                    aria-label="Remove one"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{trayItem?.quantity}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); addItem({ id: item.code, name: itemName, price: item.price }); }}
                    className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                    aria-label="Add one more"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); addItem({ id: item.code, name: itemName, price: item.price }); }}
                  className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                  aria-label="Add to order"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`${item.nameEn} — full view`}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 min-h-[36px] items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Main image */}
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={photos[activeImg] ?? mainSrc}
                alt={item.nameEn}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 512px"
                style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined}
              />
            </div>

            {/* Thumbnail strip — only shown when multiple photos available */}
            {photos.length > 1 && (
              <div className="flex gap-2 px-4 pt-3">
                {photos.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      "relative h-14 w-14 min-h-[56px] min-w-[56px] overflow-hidden rounded-lg border-2 transition-all",
                      activeImg === i ? "border-primary" : "border-transparent opacity-60",
                    )}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image src={src} alt={`${item.nameEn} view ${i + 1}`} fill className="object-cover" sizes="56px" />
                  </button>
                ))}
              </div>
            )}

            {/* Item info + recipe accordion */}
            <div className="px-4 pb-4 pt-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-foreground">{item.nameEn}</h3>
                <span className="text-sm font-medium text-primary">RM {item.price.toFixed(2)}</span>
              </div>

              {/* Add to tray */}
              <div className="mt-3 flex items-center gap-2">
                {isInTray ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decrementItem(item.code)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
                      aria-label="Remove one"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-base font-semibold tabular-nums">{trayItem?.quantity}</span>
                    <button
                      type="button"
                      onClick={() => addItem({ id: item.code, name: itemName, price: item.price })}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                      aria-label="Add one more"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-muted-foreground">in order</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addItem({ id: item.code, name: itemName, price: item.price })}
                    className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                    aria-label="Add to order"
                  >
                    <Plus className="h-4 w-4" />
                    Add to order
                  </button>
                )}
              </div>

              {recipe && (
                <details className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ingredients &amp; Preparation
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {recipe.ingredients.map((ing) => (
                      <li
                        key={ing}
                        className="rounded-full bg-primary/8 px-2 py-0.5 text-xs text-foreground"
                      >
                        {ing}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {recipe.preparation}
                  </p>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
