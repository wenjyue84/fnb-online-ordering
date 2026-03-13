"use client";

import { useState, useCallback, useEffect, useMemo, useDeferredValue } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import dynamic from "next/dynamic";
import { Eye, EyeOff, X, ArchiveRestore, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { MenuItem } from "@/types/menu";
import { getLocalizedName, formatPrice } from "@/lib/utils";
import { MenuCard } from "./menu-card";

const EditableMenuCard = dynamic(
  () => import("./editable-menu-card").then(m => m.EditableMenuCard),
  { ssr: false }
);
import { MenuFilter } from "./menu-filter";
import { FadeUp } from "@/components/ui/fade-up";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { useDebounce } from "@/hooks/use-debounce";
import { SPECIAL_DISPLAY_CATEGORIES } from "@/lib/constants";
import { useMenuFiltering, DC_PREFIX, isAvailableAtTime } from "@/hooks/useMenuFiltering";

// Display categories that are auto-computed from item data (not the junction table)
const COMPUTED_DC_NAMES = [
  SPECIAL_DISPLAY_CATEGORIES.VEGETARIAN,
  SPECIAL_DISPLAY_CATEGORIES.UNDER_RM15,
  SPECIAL_DISPLAY_CATEGORIES.FAVORITES,
];

// Sanitize a display category name for use as an HTML id
function dcSectionId(name: string) {
  return `section-dc-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
}

interface MenuGridProps {
  items: MenuItem[];
  displayCategories?: string[];
  isAdmin?: boolean;
  highlightedByCategory?: Record<string, string>;
  initialCategory?: string | null;
  initialSearch?: string;
  servingNowCategories?: string[];
  previewTime?: string | null;
  chefsCatId?: string | null;
  initialAllergenFree?: string | null;
}

export function MenuGrid({
  items,
  displayCategories = [],
  isAdmin = false,
  highlightedByCategory: initialHighlights = {},
  initialCategory = null,
  initialSearch = "",
  servingNowCategories = [],
  previewTime = null,
  chefsCatId = null,
  initialAllergenFree = null,
}: MenuGridProps) {
  // Parse preview time once
  const previewHour = previewTime ? parseInt(previewTime.split(":")[0], 10) : null;
  const previewMinute = previewTime ? parseInt(previewTime.split(":")[1], 10) : null;
  const hasPreviewTime = previewHour !== null && previewMinute !== null && !isNaN(previewHour) && !isNaN(previewMinute);
  const t = useTranslations("common");
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const router = useRouter();
  const pathname = usePathname();

  // Filter mode only: Vegetarian/Favorites filters change this value.
  // Navigation pills (display categories as sections) do NOT change this — they just scroll.
  const [category, setCategory] = useState<string | null>(() => {
    if (!initialCategory) return null;
    if (initialCategory === "__favorites__") return initialCategory;
    if (initialCategory.startsWith(DC_PREFIX)) {
      const dcName = initialCategory.slice(DC_PREFIX.length);
      if (!dcName.toLowerCase().includes("chef")) return initialCategory;
    }
    return null;
  });
  const [isEditMode, setIsEditMode] = useState(false);
  // Initialise search from server-passed ?q= value so it survives page refresh
  const [search, setSearch] = useState(initialSearch);

  const [allergenFree, setAllergenFree] = useState<string | null>(initialAllergenFree);

  // Keep URL ?q= param in sync with search state.
  // Build params explicitly from known props — avoids useSearchParams() which requires Suspense
  // and can cause NextIntlClientProvider context to be missing during SSR hydration.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (previewTime) params.set("previewTime", previewTime);
    if (allergenFree) params.set("allergenFree", allergenFree);
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, previewTime, allergenFree]);
  const debouncedSearch = useDebounce(search, 300);

  // Defer category and search so the filter pill highlights immediately (within 50ms)
  // while the expensive menu grid re-render is yielded to the browser.
  const deferredCategory = useDeferredValue(category);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const isPending = deferredCategory !== category || deferredSearch !== debouncedSearch;

  const [highlights] = useState<Record<string, string>>(initialHighlights);

  // Archive state — track items archived/restored in this session
  const [sessionArchived, setSessionArchived] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.archived).map((i) => i.id))
  );
  const [sessionRestored, setSessionRestored] = useState<Set<string>>(new Set());
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [removedFromChefsPick, setRemovedFromChefsPick] = useState<Set<string>>(new Set());
  const [addedToChefsPick, setAddedToChefsPick] = useState<Set<string>>(new Set());
  const [chefPickOrder, setChefPickOrder] = useState<string[]>([]);
  // Which section is currently visible (from scroll detection)
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Display category classification ─────────────────────────────────────────
  // Chef's Picks: special section at top (regular grid, no hero cards)
  const chefsPickDCName = displayCategories.find((dc) => dc.toLowerCase().includes("chef")) ?? null;
  // Computed DCs (Vegetarian, Under RM15): filter pills only
  const filterDCNames = useMemo(
    () => displayCategories.filter((dc) => COMPUTED_DC_NAMES.includes(dc as typeof COMPUTED_DC_NAMES[number])),
    [displayCategories]
  );
  // Manual DCs that are NOT Chef's Picks and NOT computed: navigation pills + section headers
  const navDCNames = useMemo(
    () => displayCategories.filter(
      (dc) => dc !== chefsPickDCName && !COMPUTED_DC_NAMES.includes(dc as typeof COMPUTED_DC_NAMES[number])
    ),
    [displayCategories, chefsPickDCName]
  );

  // Fetch saved Chef's Pick order from DB (no auth required on GET)
  useEffect(() => {
    if (!chefsCatId) return;
    fetch(`/api/admin/display-categories/${chefsCatId}/items`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setChefPickOrder((data as { id: string }[]).map((i) => i.id));
        }
      })
      .catch(() => {});
  }, [chefsCatId]);

  const handleRemoveChefsPick = useCallback(
    async (itemId: string) => {
      if (addedToChefsPick.has(itemId)) {
        setAddedToChefsPick((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
      } else {
        setRemovedFromChefsPick((prev) => new Set([...prev, itemId]));
      }
      if (chefsCatId) {
        await fetch(`/api/admin/display-categories/${chefsCatId}/items?itemId=${itemId}`, { method: "DELETE" });
      }
    },
    [chefsCatId, addedToChefsPick]
  );
  const handleAddChefsPick = useCallback(
    async (itemId: string) => {
      setAddedToChefsPick((prev) => new Set([...prev, itemId]));
      if (chefsCatId) {
        await fetch(`/api/admin/display-categories/${chefsCatId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
      }
    },
    [chefsCatId]
  );
  const [highlightError, setHighlightError] = useState<string | null>(null);

  // Returns true if an item should be treated as archived (locally)
  const isItemArchived = useCallback(
    (item: MenuItem) => {
      if (sessionRestored.has(item.id)) return false;
      return item.archived || sessionArchived.has(item.id);
    },
    [sessionArchived, sessionRestored]
  );

  const handleArchive = useCallback((itemId: string) => {
    setSessionArchived((prev) => new Set([...prev, itemId]));
    setSessionRestored((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    setArchivedSectionOpen(true);
  }, []);

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const handleRestore = useCallback(async (itemId: string) => {
    setRestoringId(itemId);
    try {
      await fetch(`/api/admin/menu/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      setSessionRestored((prev) => new Set([...prev, itemId]));
      setSessionArchived((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    } finally {
      setRestoringId(null);
    }
  }, []);

  // ── Non-archived items only — used for all regular sections ─────────────────
  const visibleItems = useMemo(
    () => items.filter((i) => !isItemArchived(i)),
    [items, isItemArchived]
  );

  const {
    filtered,
    isFlatView,
    isFavoritesSelected,
    selectedDisplayCat,
    isChefsPick,
  } = useMenuFiltering({
    items: visibleItems,
    selectedCategory: deferredCategory,
    searchQuery: deferredSearch,
    highlights,
    displayCategories,
    favorites,
    removedFromChefsPick,
    allergenFree,
  });

  // ── Archived items list ──────────────────────────────────────────────────────
  const archivedItems = useMemo(
    () => items.filter((i) => isItemArchived(i)),
    [items, isItemArchived]
  );

  const isChefPickLocal = useCallback(
    (item: MenuItem) =>
      (item.displayCategories.includes(SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS) || addedToChefsPick.has(item.id)) &&
      !removedFromChefsPick.has(item.id),
    [addedToChefsPick, removedFromChefsPick]
  );

  // ── Chef's Picks section items ───────────────────────────────────────────────
  const chefsPickItems = useMemo(() => {
    return visibleItems.filter(
      (item) =>
        (item.displayCategories.includes(SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS) || addedToChefsPick.has(item.id)) &&
        !removedFromChefsPick.has(item.id)
    );
  }, [visibleItems, removedFromChefsPick, addedToChefsPick]);

  const orderedChefsPickItems = useMemo(() => {
    if (chefPickOrder.length === 0) return chefsPickItems;
    return [...chefsPickItems].sort((a, b) => {
      const ai = chefPickOrder.indexOf(a.id);
      const bi = chefPickOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [chefsPickItems, chefPickOrder]);

  // ── Other DC sections ────────────────────────────────────────────────────────
  const otherDCSections = useMemo(() => {
    return navDCNames
      .map((dcName) => ({
        dcName,
        items: visibleItems.filter((item) => item.displayCategories.includes(dcName)),
      }))
      .filter((s) => s.items.length > 0);
  }, [visibleItems, navDCNames]);

  // ── Unassigned items (not in any section) ─────────────────────────────────
  const unassignedItems = useMemo(() => {
    const sectionIds = new Set<string>();
    orderedChefsPickItems.forEach((i) => sectionIds.add(i.id));
    otherDCSections.forEach((s) => s.items.forEach((i) => sectionIds.add(i.id)));
    return visibleItems.filter((i) => !sectionIds.has(i.id));
  }, [visibleItems, orderedChefsPickItems, otherDCSections]);

  // ── Scroll-to-section ────────────────────────────────────────────────────────
  const handleScrollToSection = useCallback(
    (cat: string | null) => {
      setCategory(null); // clear any active filter

      if (cat === null) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (cat === "__chefs__") {
        document.getElementById("section-chefs-picks")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      // cat is a DC name — scroll to its section
      document.getElementById(dcSectionId(cat))?.scrollIntoView({ behavior: "smooth", block: "start" });

      // Immediately prefetch images for this DC's items
      const dcItems = items.filter((i) => i.displayCategories.includes(cat) && i.code);
      for (const item of dcItems) {
        const img = new window.Image();
        img.src = item.photo ?? `/images/menu/${item.code}.jpg`;
      }
    },
    [items]
  );

  // ── Scroll detection: update activeSection ───────────────────────────────────
  useEffect(() => {
    if (isFlatView) return;

    const THRESHOLD = 180; // header (64px) + filter bar (~92px) + margin

    function updateActiveSection() {
      const chefsEl = document.getElementById("section-chefs-picks");

      if (!chefsEl) {
        let current: string | null = null;
        for (const { dcName } of otherDCSections) {
          const el = document.getElementById(dcSectionId(dcName));
          if (el && el.getBoundingClientRect().top <= THRESHOLD) current = dcName;
        }
        setActiveSection(current);
        return;
      }

      if (chefsEl.getBoundingClientRect().top > THRESHOLD) {
        setActiveSection(null);
        return;
      }

      let current: string | null = "__chefs__";
      for (const { dcName } of otherDCSections) {
        const el = document.getElementById(dcSectionId(dcName));
        if (el && el.getBoundingClientRect().top <= THRESHOLD) current = dcName;
      }
      setActiveSection(current);
    }

    window.addEventListener("scroll", updateActiveSection, { passive: true });
    updateActiveSection();
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [isFlatView, otherDCSections]);

  // ── Background image prefetch by DC order ────────────────────────────────────
  useEffect(() => {
    const chefsPickIds = new Set(chefsPickItems.map((i) => i.id));
    const codes: string[] = [];
    for (const { items: sectionItems } of otherDCSections) {
      for (const item of sectionItems) {
        if (!chefsPickIds.has(item.id) && item.code) codes.push(item.code);
      }
    }
    // Also include unassigned items
    for (const item of unassignedItems) {
      if (item.code) codes.push(item.code);
    }
    const uniqueCodes = [...new Set(codes)];

    let idx = 0;
    let cancelled = false;
    function fetchNext() {
      if (cancelled || idx >= uniqueCodes.length) return;
      const code = uniqueCodes[idx++];
      const nextItem = items.find((i) => i.code === code);
      const src = nextItem?.photo;
      if (src) {
        const img = new window.Image();
        img.src = src;
      }
      schedule();
    }
    function schedule() {
      if (cancelled || idx >= uniqueCodes.length) return;
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(fetchNext);
      } else {
        setTimeout(fetchNext, 16);
      }
    }
    const start = setTimeout(() => {
      if (cancelled) return;
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(fetchNext);
      } else {
        setTimeout(fetchNext, 0);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(start); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasChefsPicks = orderedChefsPickItems.length > 0;

  return (
    <div className="pb-48 md:pb-0">
      <MenuFilter
        categories={navDCNames}
        displayCategories={filterDCNames}
        hasChefsPicks={hasChefsPicks}
        activeSection={activeSection}
        onScrollToSection={handleScrollToSection}
        selectedCategory={category}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        searchQuery={search}
        itemCount={filtered.length}
        servingNowCategories={servingNowCategories}
        favoritesCount={favorites.length}
        allergenFree={allergenFree}
        onAllergenFreeChange={setAllergenFree}
      />

      {/* Admin edit/customer mode toggle */}
      {isAdmin && (
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={() => setIsEditMode((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
              isEditMode
                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
                : "bg-green-50 text-green-800 border-green-300 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700"
            )}
          >
            {isEditMode ? (
              <><Eye className="h-3.5 w-3.5" /> Customer View</>
            ) : (
              <><EyeOff className="h-3.5 w-3.5" /> Edit Mode</>
            )}
          </button>
        </div>
      )}

      {/* Highlight error toast */}
      {highlightError && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground mb-2">
          <span>{highlightError}</span>
          <button type="button" onClick={() => setHighlightError(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {filtered.length === 0 && isFlatView ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">
            {isFavoritesSelected
              ? t("noFavorites")
              : selectedDisplayCat === SPECIAL_DISPLAY_CATEGORIES.VEGETARIAN
              ? t("noVegetarianItems")
              : t("noResults")}
          </p>
        </div>
      ) : isFlatView ? (
        /* Search results or filter (Vegetarian, Favorites): flat grid — no hero cards */
        <div className={cn("mt-6", isPending && "opacity-70 transition-opacity duration-150")}>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item, index) => {
              const isHighlighted = isChefPickLocal(item);
              const isUnavailableAtPreview = isAdmin && hasPreviewTime ? !isAvailableAtTime(item, previewHour!, previewMinute!) : false;
              return isAdmin && isEditMode ? (
                <EditableMenuCard
                  key={item.id}
                  item={item}
                  isHighlighted={isHighlighted}
                  onSetHighlight={!isHighlighted && chefsCatId ? () => void handleAddChefsPick(item.id) : undefined}
                  onRemoveChefsPick={isHighlighted ? () => void handleRemoveChefsPick(item.id) : undefined}
                  isUnavailableAtPreview={isUnavailableAtPreview}
                  onArchive={handleArchive}
                />
              ) : (
                <FadeUp key={item.id} delay={(index % 3) * 50}>
                  <MenuCard
                    item={item}
                    priority={index === 0}
                    isHighlighted={isHighlighted}
                    isFavorited={isFavorite(item.code)}
                    onToggleFavorite={() => toggleFavorite(item.code)}
                    isAdmin={isAdmin}
                    onRemoveHighlight={undefined}
                  />
                </FadeUp>
              );
            })}
          </div>
        </div>
      ) : (
        /* All-sections view: sections organised by display category */
        <div className={cn("mt-6 space-y-10", isPending && "opacity-70 transition-opacity duration-150")}>

          {/* ── Chef's Picks section (regular grid — hero image removed) ── */}
          {orderedChefsPickItems.length > 0 && (
            <section id="section-chefs-picks" aria-labelledby="cat-chefs-picks" className="scroll-mt-[var(--menu-scroll-offset)] pt-2" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}>
              <h2
                id="cat-chefs-picks"
                className="bg-amber-50/60 dark:bg-amber-950/20 -mx-4 px-4 py-3 mb-4 border-b border-amber-200 dark:border-amber-800"
              >
                <span className="flex items-center gap-2 border-l-4 border-amber-400 pl-3 text-sm font-semibold tracking-widest uppercase text-foreground">
                  <span aria-hidden="true">⭐</span>
                  Chef&apos;s Picks
                </span>
              </h2>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {orderedChefsPickItems.map((item, idx) => {
                  return isAdmin && isEditMode ? (
                    <EditableMenuCard
                      key={item.id}
                      item={item}
                      isHighlighted={true}
                      onSetHighlight={undefined}
                      onRemoveChefsPick={() => void handleRemoveChefsPick(item.id)}
                      isUnavailableAtPreview={hasPreviewTime ? !isAvailableAtTime(item, previewHour!, previewMinute!) : false}
                      onArchive={handleArchive}
                    />
                  ) : (
                    <FadeUp key={item.id} delay={idx * 50}>
                      <MenuCard
                        item={item}
                        priority={idx === 0}
                        isHighlighted={true}
                        isFavorited={isFavorite(item.code)}
                        onToggleFavorite={() => toggleFavorite(item.code)}
                        isAdmin={isAdmin}
                        onRemoveHighlight={undefined}
                      />
                    </FadeUp>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Other display category sections ── */}
          {otherDCSections.map(({ dcName, items: sectionItems }) => (
            <section
              key={dcName}
              id={dcSectionId(dcName)}
              aria-labelledby={`cat-dc-${dcName}`}
              className="scroll-mt-[var(--menu-scroll-offset)] pt-2"
              style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
            >
              <h2
                id={`cat-dc-${dcName}`}
                className="bg-muted/30 -mx-4 px-4 py-3 mb-4 border-b border-border"
              >
                <span className="flex items-center gap-2 border-l-4 border-primary pl-3 text-sm font-semibold tracking-widest uppercase text-foreground">
                  {dcName}
                </span>
              </h2>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {sectionItems.map((item, index) => {
                  const isHighlighted = isChefPickLocal(item);
                  const isUnavailableAtPreview = hasPreviewTime ? !isAvailableAtTime(item, previewHour!, previewMinute!) : false;
                  return isAdmin && isEditMode ? (
                    <EditableMenuCard
                      key={item.id}
                      item={item}
                      isHighlighted={isHighlighted}
                      onSetHighlight={!isHighlighted && chefsCatId ? () => void handleAddChefsPick(item.id) : undefined}
                      onRemoveChefsPick={isHighlighted ? () => void handleRemoveChefsPick(item.id) : undefined}
                      isUnavailableAtPreview={isUnavailableAtPreview}
                      onArchive={handleArchive}
                    />
                  ) : (
                    <FadeUp key={item.id} delay={(index % 3) * 50}>
                      <MenuCard
                        item={item}
                        isHighlighted={isHighlighted}
                        isFavorited={isFavorite(item.code)}
                        onToggleFavorite={() => toggleFavorite(item.code)}
                        isAdmin={isAdmin}
                        onRemoveHighlight={undefined}
                      />
                    </FadeUp>
                  );
                })}
              </div>
            </section>
          ))}

          {/* ── Unassigned items (no display category) ── */}
          {unassignedItems.length > 0 && (
            <section id="section-other" aria-labelledby="cat-other" className="scroll-mt-[var(--menu-scroll-offset)] pt-2" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}>
              <h2 id="cat-other" className="bg-muted/30 -mx-4 px-4 py-3 mb-4 border-b border-border">
                <span className="flex items-center gap-2 border-l-4 border-muted-foreground/40 pl-3 text-sm font-semibold tracking-widest uppercase text-muted-foreground">
                  Other Items
                </span>
              </h2>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {unassignedItems.map((item, index) => {
                  const isHighlighted = isChefPickLocal(item);
                  return isAdmin && isEditMode ? (
                    <EditableMenuCard
                      key={item.id}
                      item={item}
                      isHighlighted={isHighlighted}
                      onSetHighlight={!isHighlighted && chefsCatId ? () => void handleAddChefsPick(item.id) : undefined}
                      onRemoveChefsPick={isHighlighted ? () => void handleRemoveChefsPick(item.id) : undefined}
                      isUnavailableAtPreview={hasPreviewTime ? !isAvailableAtTime(item, previewHour!, previewMinute!) : false}
                      onArchive={handleArchive}
                    />
                  ) : (
                    <FadeUp key={item.id} delay={(index % 3) * 50}>
                      <MenuCard
                        item={item}
                        isHighlighted={isHighlighted}
                        isFavorited={isFavorite(item.code)}
                        onToggleFavorite={() => toggleFavorite(item.code)}
                        isAdmin={isAdmin}
                        onRemoveHighlight={undefined}
                      />
                    </FadeUp>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Archived Items section (admin edit mode only) ── */}
      {isAdmin && isEditMode && archivedItems.length > 0 && (
        <section className="mt-10 border-t-2 border-dashed border-orange-200 pt-6 dark:border-orange-800/40">
          <button
            type="button"
            onClick={() => setArchivedSectionOpen((v) => !v)}
            className="mb-4 flex w-full items-center gap-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold tracking-widest uppercase text-orange-700 dark:text-orange-400">
              <span>📦</span> Archived Items
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                {archivedItems.length}
              </span>
            </span>
            <span className="ml-auto text-orange-400">
              {archivedSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {archivedSectionOpen && (
            <div className="space-y-2">
              {archivedItems.map((item) => (
                <ArchivedItemRow
                  key={item.id}
                  item={item}
                  isRestoring={restoringId === item.id}
                  onRestore={() => void handleRestore(item.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ArchivedItemRow({
  item,
  isRestoring,
  onRestore,
}: {
  item: MenuItem;
  isRestoring: boolean;
  onRestore: () => void;
}) {
  const locale = useLocale();
  const name = getLocalizedName(item, locale);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-orange-200 bg-orange-50/40 px-3 py-2 dark:border-orange-800/30 dark:bg-orange-950/20">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground/70">{name}</p>
        <p className="text-xs text-muted-foreground">{item.code} · {formatPrice(item.price)}</p>
      </div>
      <button
        type="button"
        onClick={onRestore}
        disabled={isRestoring}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-500 hover:text-white disabled:opacity-50 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-600 dark:hover:text-white"
      >
        {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="h-3 w-3" />}
        Restore
      </button>
    </div>
  );
}
