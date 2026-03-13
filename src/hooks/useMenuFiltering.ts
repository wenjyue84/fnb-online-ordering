import { useMemo } from "react";
import Fuse from "fuse.js";
import type { MenuItem } from "@/types/menu";
import { SPECIAL_DISPLAY_CATEGORIES } from "@/lib/constants";
import { expandSearchQuery } from "@/lib/search-synonyms";

// Display category values are prefixed with "__dc__" to distinguish from other filters
export const DC_PREFIX = "__dc__";

/** Returns false if an item has a time restriction and the given hour/minute is outside it. */
export function isAvailableAtTime(item: MenuItem, hour: number, minute: number): boolean {
  if (!item.available) return false;
  const { timeFrom, timeUntil } = item;
  if (!timeFrom || !timeUntil) return true;
  const [fh, fm] = timeFrom.split(":").map(Number);
  const [uh, um] = timeUntil.split(":").map(Number);
  const mins = hour * 60 + minute;
  return mins >= fh * 60 + fm && mins < uh * 60 + um;
}

// Special filter key for user-favorited items
export const FAVORITES_FILTER = "__favorites__";

// Fuse.js options defined at module level to prevent stale closure re-creation
const fuseOptions = {
  keys: [
    { name: "code", weight: 2 },
    "nameEn",
    "nameMs",
    "nameZh",
    "description",
    "displayCategories",
  ],
  threshold: 0.4,
  minMatchCharLength: 2,
  includeScore: true,
};

export interface CategorySection {
  cat: string;
  heroItems: MenuItem[];
  rest: MenuItem[];
}

export interface UseMenuFilteringParams {
  items: MenuItem[];
  selectedCategory: string | null;
  searchQuery: string;
  highlights: Record<string, string>;
  displayCategories: string[];
  favorites: string[];
  removedFromChefsPick: Set<string>;
  allergenFree?: string | null;
}

export interface UseMenuFilteringResult {
  filtered: MenuItem[];
  categorySections: CategorySection[];
  heroItems: MenuItem[];
  regularFlatItems: MenuItem[];
  isFlatView: boolean;
  isSearching: boolean;
  isFavoritesSelected: boolean;
  isDisplayCategorySelected: boolean;
  selectedDisplayCat: string | null;
  fuse: Fuse<MenuItem>;
  isChefsPick: (item: MenuItem) => boolean;
}

export function useMenuFiltering({
  items,
  selectedCategory,
  searchQuery,
  favorites,
  removedFromChefsPick,
  allergenFree = null,
}: UseMenuFilteringParams): UseMenuFilteringResult {
  // Fuse.js instance for fuzzy search across all items (memoized to avoid re-init on every render)
  const fuse = useMemo(() => new Fuse(items, fuseOptions), [items]);

  // Resolve whether selected tab is a display category or favorites filter
  const isFavoritesSelected = selectedCategory === FAVORITES_FILTER;
  const isDisplayCategorySelected =
    !isFavoritesSelected && (selectedCategory?.startsWith(DC_PREFIX) ?? false);
  const selectedDisplayCat = isDisplayCategorySelected
    ? selectedCategory!.slice(DC_PREFIX.length)
    : null;

  const isChefsPick = (item: MenuItem) =>
    item.displayCategories.includes(SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS) &&
    !removedFromChefsPick.has(item.id);

  const isSearching = searchQuery.trim().length > 0;
  // Flat view: searching, a display category filter is active, or favorites selected.
  // Default (no filter) shows the organised display-category sections view.
  const isFlatView = isSearching || isDisplayCategorySelected || isFavoritesSelected;

  const filtered = useMemo(() => {
    // Compute base result from search / category filters
    let result: MenuItem[];

    // Semantic search: expand query with synonyms, then fuzzy-search each variant.
    // E.g. "ice coffee" also searches "ice kopi", "iced coffee", "ais coffee", etc.
    if (searchQuery.trim().length >= 2) {
      const expandedQueries = expandSearchQuery(searchQuery);
      if (expandedQueries.length === 1) {
        result = fuse.search(searchQuery).map((r) => r.item);
      } else {
        // Merge results from all expanded queries, preserving order (original query first)
        const seen = new Set<string>();
        result = [];
        for (const q of expandedQueries) {
          for (const r of fuse.search(q)) {
            if (!seen.has(r.item.id)) {
              seen.add(r.item.id);
              (result as MenuItem[]).push(r.item);
            }
          }
        }
      }
    } else if (isFavoritesSelected) {
      result = items.filter((i) => favorites.includes(i.code));
    } else if (selectedDisplayCat) {
      if (selectedDisplayCat === SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS) {
        const fromJunction = items.filter((item) =>
          item.displayCategories.includes(selectedDisplayCat)
        );
        result = fromJunction.length > 0 ? fromJunction : items.filter((i) => i.featured);
      } else if (selectedDisplayCat === SPECIAL_DISPLAY_CATEGORIES.UNDER_RM15) {
        result = items.filter(
          (i) =>
            i.price < 15 &&
            !i.displayCategories.some(
              (dc) => dc === "Hot Drinks" || dc === "Cold Drinks & Juice"
            )
        );
      } else if (selectedDisplayCat === SPECIAL_DISPLAY_CATEGORIES.VEGETARIAN) {
        result = items.filter((i) =>
          i.dietary?.some((d) => d.toLowerCase() === "vegetarian")
        );
      } else {
        result = items.filter((item) => item.displayCategories.includes(selectedDisplayCat));
      }
    } else {
      result = items;
    }

    // Apply allergen-free filter: hide items that contain the selected allergen
    if (allergenFree) {
      result = result.filter((item) => !(item.allergens ?? []).includes(allergenFree));
    }

    return result;
  }, [items, selectedDisplayCat, isFavoritesSelected, favorites, searchQuery, fuse, allergenFree]);

  // categorySections: kept in result for API compat but unused — sections built in MenuGrid
  const categorySections = useMemo<CategorySection[]>(() => [], []);

  // In flat view: Chef's Picks items float to top as hero cards
  const heroItems = useMemo(() => {
    if (!isFlatView || isSearching || isFavoritesSelected) return [];
    if (selectedDisplayCat === SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS)
      return filtered.slice(0, 2);
    const isChefPick = (i: MenuItem) =>
      i.displayCategories.includes(SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS) &&
      !removedFromChefsPick.has(i.id);
    if (selectedDisplayCat) {
      return filtered.filter((i) => isChefPick(i)).slice(0, 2);
    }
    return filtered.filter((i) => isChefPick(i));
  }, [filtered, isFlatView, isSearching, isFavoritesSelected, selectedDisplayCat, removedFromChefsPick]);

  const regularFlatItems = useMemo(() => {
    const heroIds = new Set(heroItems.map((i) => i.id));
    return filtered.filter((i) => !heroIds.has(i.id));
  }, [filtered, heroItems]);

  return {
    filtered,
    categorySections,
    heroItems,
    regularFlatItems,
    isFlatView,
    isSearching,
    isFavoritesSelected,
    isDisplayCategorySelected,
    selectedDisplayCat,
    fuse,
    isChefsPick,
  };
}
