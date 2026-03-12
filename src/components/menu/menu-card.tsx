"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Minus, Heart } from "lucide-react";
import { useTrayActions, useTrayItemCount } from "@/lib/tray-context";
import type { MenuItemWithRules } from "@/types/menu";
import { formatPrice, getLocalizedName, cn, getCategoryEmoji } from "@/lib/utils";
import { DietaryBadge } from "./dietary-badge";
import { ImageCarousel } from "./image-carousel";

const RecipeModal = dynamic(
  () => import("./recipe-modal").then((m) => ({ default: m.RecipeModal })),
  { ssr: false, loading: () => null }
);

interface MenuCardProps {
  item: MenuItemWithRules;
  priority?: boolean;
  isHighlighted?: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  isAdmin?: boolean;
  onRemoveHighlight?: () => void;
}

export function MenuCard({ item, priority = false, isHighlighted = false, isFavorited = false, onToggleFavorite, isAdmin = false, onRemoveHighlight }: MenuCardProps) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const { addItem, decrementItem } = useTrayActions();
  const trayCount = useTrayItemCount(item.code);
  const name = getLocalizedName(item, locale);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevQuantityRef = useRef<number>(0);
  const imgVersion = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const hasPhoto = !!item.photo && !imgError;

  const isInTray = trayCount > 0;

  // Pulse when quantity increases (re-add)
  useEffect(() => {
    if (trayCount > prevQuantityRef.current && prevQuantityRef.current > 0) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 600);
      return () => clearTimeout(t);
    }
    prevQuantityRef.current = trayCount;
  }, [trayCount]);

  const cardClass = isInTray
    ? `group w-full overflow-hidden rounded-xl border hover-lift transition-colors bg-green-50/40 dark:bg-green-900/10 ring-2 ring-green-400/40 ${isHighlighted ? "border-amber-400" : "border-green-300/60"}`
    : `group w-full overflow-hidden rounded-xl border bg-card hover-lift ${isHighlighted ? "border-amber-400 ring-2 ring-amber-400/60" : "border-border"}`;

  return (
    <>
      <div
        className={cardClass}
        style={{ contain: "content" }}
        onMouseEnter={() => {
          hoverTimer.current = setTimeout(() => setShowDesc(true), 2000);
        }}
        onMouseLeave={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          setShowDesc(false);
        }}
      >
        {/* Photo — click to open detail modal */}
        <div
          className={cn(
            "relative aspect-[4/3] overflow-hidden cursor-pointer",
            imgLoaded || !hasPhoto ? "bg-muted" : "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 animate-pulse"
          )}
          onClick={() => setRecipeOpen(true)}
          role="button"
          aria-label={`View details for ${name}`}
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setRecipeOpen(true)}
        >
          {hasPhoto ? (
            item.photos && item.photos.length > 1 ? (
              <ImageCarousel
                photos={item.photos}
                alt={name}
                priority={priority}
                imagePosition={item.imagePosition}
                version={imgVersion || undefined}
                onLoad={() => setImgLoaded(true)}
              />
            ) : (
              <Image
                src={`${item.photo}${imgVersion ? `?v=${imgVersion}` : ""}`}
                alt={name}
                fill
                className="object-cover img-scale"
                style={{ objectPosition: item.imagePosition || "50% 50%" }}
                sizes="(max-width: 640px) calc(50vw - 24px), (max-width: 1024px) 50vw, 33vw"
                priority={priority}
                loading={priority ? "eager" : "lazy"}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/30">
              <span className="text-4xl" aria-hidden="true">{getCategoryEmoji(item.categories)}</span>
            </div>
          )}
          {isHighlighted && (
            isAdmin && onRemoveHighlight ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveHighlight();
                }}
                className="absolute left-2 top-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow cursor-pointer hover:opacity-75 transition-opacity"
                title="Click to remove from Chef's Pick"
              >
                ★ Chef&apos;s Pick ✕
              </button>
            ) : (
              <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow">
                ★ Chef&apos;s Pick
              </span>
            )
          )}
          {!isHighlighted && item.featured && (
            <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              ★
            </span>
          )}
          {item.discountPercent && (
            <span className="absolute left-2 bottom-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              -{item.discountPercent}%
            </span>
          )}
          {/* Heart / Favorite toggle — top-right, always visible */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                "absolute top-2 right-2 z-10 rounded-full p-1.5 transition-[background-color] duration-200",
                isFavorited ? "bg-black/50 hover:bg-black/70" : "bg-black/30 hover:bg-black/50"
              )}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-colors",
                  isFavorited ? "fill-red-500 text-red-500" : "fill-transparent text-white"
                )}
              />
            </button>
          )}
        </div>

        {/* Always-visible info section */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: name + price + collapsible description + dietary */}
            <div className="flex-1 min-w-0 space-y-1">
              <p
                className="font-semibold leading-snug text-sm text-foreground line-clamp-2 cursor-pointer select-none"
                title={name}
                onClick={() => setShowDesc((v) => !v)}
              >
                {name}
              </p>
              {isAdmin && item.code && (
                <span aria-hidden="true" className="font-mono text-[10px] text-muted-foreground/50 leading-none">
                  {item.code}
                </span>
              )}
              <p className="text-xs font-bold text-primary">
                {item.originalPrice ? (
                  <>
                    <s className="text-muted-foreground font-normal mr-1">{formatPrice(item.originalPrice)}</s>
                    {formatPrice(item.price)}
                  </>
                ) : (
                  formatPrice(item.price)
                )}
              </p>
              {item.description && (
                <p
                  className={cn(
                    "text-xs text-muted-foreground cursor-pointer transition-all duration-200",
                    showDesc ? "" : "line-clamp-1"
                  )}
                  onClick={() => setShowDesc((v) => !v)}
                >
                  {item.description}
                </p>
              )}
              {item.dietary.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {item.dietary.map((d) => (
                    <DietaryBadge key={d} label={d} />
                  ))}
                </div>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="shrink-0">
              {isInTray ? (
                <div className={cn("flex items-center gap-1", pulsing ? "animate-pulse" : "")}>
                  <button
                    type="button"
                    onClick={() => decrementItem(item.code)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all active:scale-95 hover:bg-primary hover:text-primary-foreground"
                    aria-label="Remove one"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">
                    {trayCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem({ id: item.code, name, price: item.price })}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all active:scale-95 hover:bg-primary/90"
                    aria-label="Add one more"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => addItem({ id: item.code, name, price: item.price })}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all active:scale-95 hover:bg-primary hover:text-primary-foreground"
                  aria-label={tc("add")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <RecipeModal
        item={item}
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
      />
    </>
  );
}
