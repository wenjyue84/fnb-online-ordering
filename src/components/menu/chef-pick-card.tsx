"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Minus, Info, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Check, Loader2, Crown } from "lucide-react";
import { useTray } from "@/lib/tray-context";
import type { MenuItemWithRules } from "@/types/menu";
import { formatPrice, getLocalizedName, cn, getCategoryEmoji } from "@/lib/utils";
import { DietaryBadge } from "./dietary-badge";
import { RecipeModal } from "./recipe-modal";
import { getRecipeInfo } from "@/data/recipe-info";

function parsePosition(pos: string): [number, number] {
  const parts = pos.split(" ").map((p) => parseInt(p, 10));
  return [isNaN(parts[0]) ? 50 : parts[0], isNaN(parts[1]) ? 50 : parts[1]];
}

interface ChefPickCardProps {
  item: MenuItemWithRules;
  priority?: boolean;
  compact?: boolean;
  isAdmin?: boolean;
  isSignature?: boolean;
  onRemoveChefsPick?: () => void;
  onSetSignature?: () => void;
}

export function ChefPickCard({ item, priority = false, compact = false, isAdmin = false, isSignature = false, onRemoveChefsPick, onSetSignature }: ChefPickCardProps) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const { addItem, decrementItem, items } = useTray();
  const name = getLocalizedName(item, locale);
  const [imgError, setImgError] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [imagePosition, setImagePosition] = useState(item.imagePosition || "50% 50%");
  const [positionDirty, setPositionDirty] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [showSignatureConfirm, setShowSignatureConfirm] = useState(false);

  function adjustPosition(dx: number, dy: number) {
    const [x, y] = parsePosition(imagePosition);
    const nx = Math.max(0, Math.min(100, x + dx));
    const ny = Math.max(0, Math.min(100, y + dy));
    setImagePosition(`${nx}% ${ny}%`);
    setPositionDirty(true);
  }

  async function savePosition() {
    setSavingPosition(true);
    try {
      await fetch(`/api/admin/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePosition }),
      });
      setPositionDirty(false);
    } finally {
      setSavingPosition(false);
    }
  }
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const trayItem = items.find((i) => i.id === item.code);
  const isInTray = !!trayItem;
  const hasPhoto = !!item.code && !imgError;
  const hasRecipe = !!getRecipeInfo(item.nameEn);
  const imgVersion = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const imgSrc = `${item.photo}${imgVersion ? `?v=${imgVersion}` : ""}`;

  return (
    <>
      <div
        className={cn(
          "group w-full rounded-xl border-2 border-amber-400 ring-2 ring-amber-400/40 bg-card overflow-hidden hover-lift",
          compact && "flex flex-col h-full"
        )}
        onMouseEnter={() => {
          setShowInfo(true);
          hoverTimer.current = setTimeout(() => setShowDesc(true), 2000);
        }}
        onMouseLeave={() => {
          setShowInfo(false);
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
        }}
      >
        {/* Full-width landscape image */}
        <div
          className={cn(
            "relative w-full overflow-hidden bg-muted cursor-pointer",
            compact ? "chef-pick-compact-img" : "aspect-video"
          )}
          onClick={() => {
            if (longPressTriggered.current) {
              longPressTriggered.current = false;
              return;
            }
            setShowDesc((v) => !v);
          }}
          onTouchStart={() => {
            longPressTriggered.current = false;
            longPressTimer.current = setTimeout(() => {
              longPressTriggered.current = true;
              setShowInfo(true);
            }, 2000);
          }}
          onTouchEnd={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            if (longPressTriggered.current) {
              longPressTriggered.current = false;
              setShowInfo(false);
            }
          }}
          onTouchCancel={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressTriggered.current = false;
            setShowInfo(false);
          }}
          role="button"
          aria-label={`Toggle description for ${name}`}
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setShowDesc((v) => !v)}
        >
          {hasPhoto ? (
            <Image
              src={imgSrc}
              alt={item.categories[0] ? `${name} — ${item.categories[0]}` : name}
              fill
              className="object-cover img-scale"
              style={{ objectPosition: imagePosition }}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/30">
              <span className="text-6xl" aria-hidden="true">{getCategoryEmoji(item.categories)}</span>
            </div>
          )}

          {/* Chef's Pick badge — admin mode shows remove + set-signature buttons */}
          {isAdmin ? (
            <div className="absolute left-2 top-2 flex items-center gap-1 group/badge">
              {/* Remove from Chef's Pick */}
              {onRemoveChefsPick ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveChefsPick(); }}
                  className={cn(
                    "rounded-full bg-amber-400 font-bold text-amber-900 shadow-md flex items-center gap-1 transition-colors hover:bg-red-500 hover:text-white",
                    compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
                  )}
                  aria-label="Remove from Chef's Pick"
                >
                  ★ Chef&apos;s Pick <X className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
                </button>
              ) : (
                <span className={cn(
                  "rounded-full bg-amber-400 font-bold text-amber-900 shadow-md",
                  compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
                )}>
                  ★ Chef&apos;s Pick
                </span>
              )}
              {/* Set as Signature Dish — appears on badge hover, hidden if already signature */}
              {onSetSignature && !isSignature && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowSignatureConfirm(true); }}
                  className="opacity-0 group-hover/badge:opacity-100 focus:opacity-100 transition-opacity rounded-full bg-yellow-300 p-1 text-yellow-900 shadow-md hover:bg-yellow-400"
                  title="Set as Signature Dish (appears as hero on landing page)"
                  aria-label="Set as Signature Dish"
                >
                  <Crown className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </button>
              )}
              {/* Signature crown indicator */}
              {isSignature && (
                <span className={cn(
                  "rounded-full bg-yellow-400 font-bold text-yellow-900 shadow-md flex items-center gap-1",
                  compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
                )}>
                  <Crown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /> Signature
                </span>
              )}
            </div>
          ) : (
            /* Customer view */
            isSignature ? (
              <span className={cn(
                "absolute left-2 top-2 rounded-full bg-yellow-400 font-bold text-yellow-900 shadow-md flex items-center gap-1",
                compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
              )}>
                <Crown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /> ★ Signature
              </span>
            ) : (
              <span className={cn(
                "absolute left-2 top-2 rounded-full bg-amber-400 font-bold text-amber-900 shadow-md",
                compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
              )}>
                ★ Chef&apos;s Pick
              </span>
            )
          )}

          {item.discountPercent && (
            <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-sm font-bold text-white">
              -{item.discountPercent}%
            </span>
          )}

          {/* Info icon — clickable to open recipe modal */}
          {hasRecipe && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRecipeOpen(true);
              }}
              className="absolute bottom-3 right-3 rounded-full bg-black/50 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`View ingredients for ${name}`}
            >
              <Info className="h-4 w-4 text-white" />
            </button>
          )}

          {/* Focal point controls — admin mode only */}
          {isAdmin && hasPhoto && (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 transition-opacity group-hover:opacity-100 pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => adjustPosition(0, -5)}
                  className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                  title="Pan up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => adjustPosition(-5, 0)}
                    className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                    title="Pan left"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <div className="h-7 w-7" />
                  <button
                    type="button"
                    onClick={() => adjustPosition(5, 0)}
                    className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                    title="Pan right"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => adjustPosition(0, 5)}
                  className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                  title="Pan down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Signature dish confirmation overlay */}
          {showSignatureConfirm && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 rounded-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-background rounded-xl p-4 shadow-xl w-full max-w-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
                  <p className="font-bold text-sm">Set as Signature Dish?</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{name}</span> will appear as the hero image on the landing page. Any current signature dish will be replaced.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { onSetSignature?.(); setShowSignatureConfirm(false); }}
                    className="flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold py-2 hover:bg-primary/90 transition-colors"
                  >
                    Set as Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignatureConfirm(false)}
                    className="flex-1 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium py-2 hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save position button — appears when dirty */}
          {isAdmin && positionDirty && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => void savePosition()}
                disabled={savingPosition}
                className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow"
              >
                {savingPosition ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => { setImagePosition(item.imagePosition || "50% 50%"); setPositionDirty(false); }}
                className="rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80 shadow"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Collapsible info drawer — slides down on hover (desktop) / 2s hold (mobile) */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            showInfo ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div
            className={cn(
              "transition-transform duration-300",
              compact ? "px-3 pt-2.5 pb-3" : "px-4 sm:px-5 pt-3 pb-4",
              showInfo ? "translate-y-0" : "-translate-y-2"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left: name + price + description + dietary */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className={cn("font-bold leading-snug text-foreground", compact ? "text-sm truncate" : "text-base")}>{name}</p>
                <p className={cn("font-bold text-primary", compact ? "text-xs" : "text-sm")}>
                  {item.originalPrice ? (
                    <>
                      <s className="text-muted-foreground font-normal mr-1 text-xs">{formatPrice(item.originalPrice)}</s>
                      {formatPrice(item.price)}
                    </>
                  ) : (
                    formatPrice(item.price)
                  )}
                </p>
                {item.description && (
                  <div
                    className={cn(
                      "text-muted-foreground overflow-hidden transition-all duration-300",
                      compact ? "text-xs" : "text-sm",
                      showDesc ? "max-h-48 opacity-100 pt-0.5" : "max-h-0 opacity-0"
                    )}
                  >
                    {item.description}
                  </div>
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
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => decrementItem(item.code)}
                      className={cn(
                        "flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground",
                        compact ? "h-8 w-8" : "h-9 w-9"
                      )}
                      aria-label="Remove one"
                    >
                      <Minus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                    </button>
                    <span className={cn("text-center font-semibold tabular-nums", compact ? "w-5 text-sm" : "w-6 text-sm")}>
                      {trayItem?.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem({ id: item.code, name, price: item.price })}
                      className={cn(
                        "flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
                        compact ? "h-8 w-8" : "h-9 w-9"
                      )}
                      aria-label="Add one more"
                    >
                      <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addItem({ id: item.code, name, price: item.price })}
                    className={cn(
                      "flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground",
                      compact ? "h-8 w-8" : "h-9 w-9"
                    )}
                    aria-label={tc("add")}
                  >
                    <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasRecipe && (
        <RecipeModal
          item={item}
          open={recipeOpen}
          onClose={() => setRecipeOpen(false)}
        />
      )}
    </>
  );
}
