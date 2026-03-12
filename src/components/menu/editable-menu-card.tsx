"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Camera, Pencil, Check, X, Loader2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ImagePlus, Eye, EyeOff, Crown, Archive, Star } from "lucide-react";
import { useTray } from "@/lib/tray-context";
import type { MenuItemWithRules } from "@/types/menu";
import { formatPrice, getLocalizedName, cn } from "@/lib/utils";
import { DietaryBadge } from "./dietary-badge";
import { RecipeModal } from "./recipe-modal";
import { getRecipeInfo } from "@/data/recipe-info";
import { useMenuItemEdit } from "@/hooks/use-menu-item-edit";

interface EditableMenuCardProps {
  item: MenuItemWithRules;
  priority?: boolean;
  isHighlighted?: boolean;
  onSetHighlight?: () => void;
  onRemoveChefsPick?: () => void;
  isUnavailableAtPreview?: boolean;
  /** Whether this item is currently the hero/signature dish on the home page */
  isSignature?: boolean;
  /** Called when admin clicks "Set as Hero" */
  onSetSignature?: () => void;
  /** Called after item is successfully archived */
  onArchive?: (itemId: string) => void;
}

export function EditableMenuCard({
  item,
  priority = false,
  isHighlighted = false,
  onSetHighlight,
  onRemoveChefsPick,
  isUnavailableAtPreview = false,
  isSignature = false,
  onSetSignature,
  onArchive,
}: EditableMenuCardProps) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const { addItem } = useTray();

  const {
    localItem,
    imgSrc,
    imgError,
    setImgError,
    isLocalUpload,
    editing,
    draftValue,
    setDraftValue,
    draftNameEn,
    setDraftNameEn,
    draftNameMs,
    setDraftNameMs,
    draftNameZh,
    setDraftNameZh,
    saving,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    isTouchDevice,
    showSignatureConfirm,
    setShowSignatureConfirm,
    imagePosition,
    setImagePosition,
    positionDirty,
    setPositionDirty,
    savingPosition,
    secondaryPhotos,
    nextSecondaryIndex,
    fileRef,
    archiveItem,
    startEdit,
    commitEdit,
    cancelEdit,
    toggleAvailable,
    adjustPosition,
    savePosition,
    uploadPrimaryFile,
    handleImageUpload,
    handlePrimaryDelete,
    uploadSecondaryFile,
    handleSecondaryUpload,
    handleSecondaryDelete,
    promoteSecondaryToPrimary,
  } = useMenuItemEdit(item);

  const addPhotoRef = useRef<HTMLInputElement>(null);
  const slotRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [recipeOpen, setRecipeOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // null = not dragging; number = dragging over that imageIndex; "new" = dragging over the Add slot
  const [dragOverSecondary, setDragOverSecondary] = useState<number | "new" | null>(null);

  const name = getLocalizedName(localItem, locale);
  const hasPhoto = !imgError;
  const hasRecipe = !!getRecipeInfo(localItem.nameEn);

  return (
    <>
      <div className={`relative rounded-xl border bg-card p-4 hover-lift group/card ${isHighlighted ? "border-amber-400 ring-2 ring-amber-400/60" : "border-amber-400/60"} ${isUnavailableAtPreview || !localItem.available ? "opacity-60" : ""}`}>
        {/* Hidden from menu badge */}
        {!localItem.available && (
          <div className="absolute inset-x-3 top-2 z-20 flex items-center justify-center">
            <span className="rounded-full bg-red-600/80 px-2.5 py-0.5 text-xs font-medium text-white">
              Hidden from menu
            </span>
          </div>
        )}

        {/* Preview-unavailable overlay */}
        {isUnavailableAtPreview && localItem.available && (
          <div className="absolute inset-x-3 top-2 z-20 flex items-center justify-center">
            <span className="rounded-full bg-slate-700/80 px-2.5 py-0.5 text-xs font-medium text-white">
              Not serving at preview time
            </span>
          </div>
        )}

        {/* Saving overlay */}
        {saving && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* Error toast */}
        {errorMsg && (
          <div className="absolute inset-x-3 top-2 z-30 flex items-center justify-between gap-2 rounded bg-destructive px-3 py-1.5 text-xs text-destructive-foreground">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Success toast */}
        {successMsg && (
          <div className="absolute inset-x-3 top-2 z-30 flex items-center justify-between gap-2 rounded bg-green-600 px-3 py-1.5 text-xs text-white">
            <span>{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg(null)}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Hidden file input — primary */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />
        {/* Hidden file input — add new secondary */}
        <input
          ref={addPhotoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            void handleSecondaryUpload(e, nextSecondaryIndex);
            if (addPhotoRef.current) addPhotoRef.current.value = "";
          }}
        />

        {/* Image area */}
        <div
          className={cn("mb-3 relative aspect-[4/3] overflow-hidden rounded-lg bg-muted transition-[box-shadow]", isDragOver && "ring-2 ring-primary ring-offset-1")}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.stopPropagation(); setIsDragOver(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith("image/")) void uploadPrimaryFile(file);
          }}
        >
          {hasPhoto ? (
            <Image
              src={imgSrc}
              alt={localItem.categories[0] ? `${name} — ${localItem.categories[0]}` : name}
              fill
              className={cn("object-cover img-scale transition-[filter]", !localItem.available && "grayscale")}
              style={{ objectPosition: imagePosition }}
              sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              onError={() => setImgError(true)}
              unoptimized={isLocalUpload}
            />
          ) : (
            <div className={cn("flex h-full items-center justify-center text-3xl text-muted-foreground/30", !localItem.available && "grayscale")}>
              🍽️
            </div>
          )}
          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-1 rounded-lg bg-primary/20 backdrop-blur-[1px] pointer-events-none">
              <Camera className="h-6 w-6 text-primary" />
              <span className="text-xs font-semibold text-primary">Drop to upload</span>
            </div>
          )}

          {/* Delete primary image — top-right X */}
          {hasPhoto && (
            <button
              type="button"
              onClick={() => void handlePrimaryDelete()}
              className={cn(
                "absolute right-1 top-1 z-20 rounded-full bg-red-500 p-1 text-white transition-opacity hover:bg-red-600",
                isTouchDevice ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
              )}
              title="Remove primary photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Light overlay for hidden items — makes image look washed out */}
          {!localItem.available && (
            <div className="absolute inset-0 z-[1] bg-background/40 pointer-events-none" />
          )}

          {isHighlighted && (
            onRemoveChefsPick ? (
              <button
                type="button"
                onClick={onRemoveChefsPick}
                className="absolute left-2 top-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow hover:bg-red-500 hover:text-white transition-colors"
                title="Click to remove from Chef's Picks"
              >
                ★ Chef&apos;s Pick ×
              </button>
            ) : (
              <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow">
                ★ Chef&apos;s Pick
              </span>
            )
          )}
          {!isHighlighted && localItem.featured && (
            <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              ★
            </span>
          )}
          {localItem.discountPercent && !isSignature && (
            <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              -{localItem.discountPercent}%
            </span>
          )}

          {/* Set as Hero / Hero badge — top-right corner */}
          {isSignature ? (
            <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-yellow-900 shadow">
              <Crown className="h-3 w-3" /> Hero
            </span>
          ) : onSetSignature ? (
            <button
              type="button"
              onClick={() => setShowSignatureConfirm(true)}
              className={cn(
                "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-yellow-300/90 px-2 py-0.5 text-xs font-bold text-yellow-900 shadow transition-opacity hover:bg-yellow-400",
                isTouchDevice ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
              )}
              title="Set as Hero Dish (appears on the landing page)"
            >
              <Crown className="h-3 w-3" /> Set Hero
            </button>
          ) : null}

          {/* Set as Chef's Pick button — hover on desktop, always on touch */}
          {!isHighlighted && onSetHighlight && (
            <button
              type="button"
              onClick={onSetHighlight}
              className={cn(
                "absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-amber-400/90 px-2.5 py-1.5 text-xs font-bold text-amber-900 transition-opacity hover:bg-amber-400",
                isTouchDevice ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
              )}
              title="Set as Chef's Pick for this category"
            >
              ★ Chef&apos;s Pick
            </button>
          )}

          {/* Camera button — always visible in edit mode */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/90"
            title="Change photo"
          >
            <Camera className="h-3.5 w-3.5" />
            Photo
          </button>

          {/* Focal point arrow controls */}
          {hasPhoto && (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40 transition-opacity group-hover/card:opacity-100 pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-center gap-0.5">
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

          {/* Signature confirm overlay */}
          {showSignatureConfirm && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 rounded-lg p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-[200px] space-y-3 rounded-xl bg-background p-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 shrink-0 text-yellow-500" />
                  <p className="text-xs font-bold">Set as Hero?</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{name}</span> will appear as the hero image on the landing page.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { onSetSignature?.(); setShowSignatureConfirm(false); }}
                    className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignatureConfirm(false)}
                    className="flex-1 rounded-lg bg-secondary py-1.5 text-xs text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secondary image slots — unlimited */}
        <div className="mb-2 flex flex-wrap gap-2">
          {secondaryPhotos.map((photo, i) => {
            const imageIndex = i + 2;
            const isOver = dragOverSecondary === imageIndex;
            return (
              <div
                key={imageIndex}
                className="relative"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverSecondary(imageIndex); }}
                onDragLeave={(e) => { e.stopPropagation(); setDragOverSecondary(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverSecondary(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) void uploadSecondaryFile(file, imageIndex);
                }}
              >
                <div className={cn("relative h-14 w-20 overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 transition-[box-shadow,border-color]", isOver ? "border-primary ring-1 ring-primary" : "border-gray-300")}>
                  <Image
                    src={photo}
                    alt={`Photo ${imageIndex}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {isOver && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/20 pointer-events-none">
                      <Camera className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void promoteSecondaryToPrimary(imageIndex)}
                    className="absolute left-0.5 top-0.5 z-20 rounded-full bg-amber-400 p-0.5 text-amber-900 hover:bg-amber-500"
                    title="Set as primary photo"
                  >
                    <Star className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSecondaryDelete(imageIndex)}
                    className="absolute right-0.5 top-0.5 z-20 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                    title={`Delete photo ${imageIndex}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                <input
                  ref={(el) => { slotRefs.current[imageIndex] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleSecondaryUpload(e, imageIndex)}
                />
                <button
                  type="button"
                  onClick={() => slotRefs.current[imageIndex]?.click()}
                  className="absolute -bottom-0.5 left-0 right-0 flex justify-center rounded-b-lg bg-black/60 py-0.5 text-[10px] text-white hover:bg-black/80"
                  title={`Replace photo ${imageIndex}`}
                >
                  <Camera className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
          {/* Add new photo — also accepts drag-and-drop */}
          <div
            className="relative"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverSecondary("new"); }}
            onDragLeave={(e) => { e.stopPropagation(); setDragOverSecondary(null); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverSecondary(null);
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("image/")) void uploadSecondaryFile(file, nextSecondaryIndex);
            }}
          >
            <button
              type="button"
              onClick={() => addPhotoRef.current?.click()}
              className={cn(
                "flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed bg-gray-50 transition-colors",
                dragOverSecondary === "new"
                  ? "border-primary text-primary"
                  : "border-gray-300 text-gray-400 hover:border-orange-400 hover:text-orange-500"
              )}
              title="Add another photo"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="text-[10px]">{dragOverSecondary === "new" ? "Drop!" : "Add"}</span>
            </button>
          </div>
        </div>

        {/* Save position button — shown when position changed */}
        {positionDirty && (
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void savePosition()}
              disabled={savingPosition}
              className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingPosition ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save Position
            </button>
            <button
              type="button"
              onClick={() => { setImagePosition(localItem.imagePosition || "50% 50%"); setPositionDirty(false); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>
        )}

        {/* Content */}
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            {/* Name — click pencil to edit (EN / MS / ZH) */}
            {editing === "names" ? (
              <div className="space-y-1">
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">EN</span>
                  <input
                    autoFocus
                    value={draftNameEn}
                    onChange={(e) => setDraftNameEn(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="w-full rounded border bg-background px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Name in English"
                  />
                </div>
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">MS</span>
                  <input
                    value={draftNameMs}
                    onChange={(e) => setDraftNameMs(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                    placeholder="(same as EN)"
                    className="w-full rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">ZH</span>
                  <input
                    value={draftNameZh}
                    onChange={(e) => setDraftNameZh(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                    placeholder="(same as EN)"
                    className="w-full rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={cancelEdit} className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void commitEdit()} className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    <Check className="h-3 w-3" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h3 className="font-semibold leading-snug">{name}</h3>
                <button
                  type="button"
                  onClick={() => startEdit("names")}
                  className="rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  title="Edit name (EN / MS / ZH)"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Price — click pencil to edit */}
            {editing === "price" ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">RM</span>
                <input
                  autoFocus
                  type="number"
                  step="0.10"
                  min="0"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-16 rounded border bg-background px-1 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="button" onClick={() => void commitEdit()} className="rounded bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </button>
                <button type="button" onClick={cancelEdit} className="rounded bg-muted p-0.5 text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-primary">
                  {localItem.originalPrice ? (
                    <>
                      <s className="mr-1 text-xs font-normal text-muted-foreground">
                        {formatPrice(localItem.originalPrice)}
                      </s>
                      {formatPrice(localItem.price)}
                    </>
                  ) : (
                    formatPrice(localItem.price)
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit("price")}
                  className="rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  title="Edit price"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Description — click pencil to edit */}
          {editing === "description" ? (
            <div>
              <textarea
                autoFocus
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                className="w-full resize-none rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
              />
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={cancelEdit} className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
                <button type="button" onClick={() => void commitEdit()} className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  <Check className="h-3 w-3" /> Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1">
              <p className="flex-1 line-clamp-2 text-sm text-muted-foreground">
                {localItem.description || (
                  <span className="italic opacity-40">No description</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => startEdit("description")}
                className="mt-0.5 shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                title="Edit description"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          {localItem.dietary.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {localItem.dietary.map((d) => (
                <DietaryBadge key={d} label={d} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          {/* Left: availability toggle + archive button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void toggleAvailable()}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors",
                localItem.available
                  ? "text-green-700 bg-green-50 border-green-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  : "text-red-700 bg-red-100 border-red-300 hover:bg-red-200"
              )}
              title={localItem.available ? "Click to hide from menu" : "Click to show on menu"}
            >
              {localItem.available ? (
                <><Eye className="h-3 w-3" /> Live</>
              ) : (
                <><EyeOff className="h-3 w-3" /> Hidden</>
              )}
            </button>
            <button
              type="button"
              onClick={() => void archiveItem(onArchive)}
              className="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-500 transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-orange-500 dark:hover:bg-orange-950/30 dark:hover:text-orange-400"
              title="Archive this item (remove from menu; restore from Archived Items section)"
            >
              <Archive className="h-3 w-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => addItem({ id: localItem.code, name, price: localItem.price })}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            {tc("add")}
          </button>
        </div>
      </div>

      {hasRecipe && (
        <RecipeModal
          item={localItem}
          open={recipeOpen}
          onClose={() => setRecipeOpen(false)}
        />
      )}
    </>
  );
}
