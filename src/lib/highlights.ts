import sql from "./db";
import { unstable_cache } from "next/cache";
import type { MenuItem } from "@/types/menu";

/** Cached: persisted highlights from DB (tag: 'menu'). */
const getCachedHighlights = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const rows = await sql`SELECT category, item_id FROM category_highlights`;
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.category as string] = row.item_id as string;
      }
      return result;
    } catch {
      return {};
    }
  },
  ["category-highlights"],
  { tags: ["menu"] }
);

// Fetch persisted highlights from DB. Returns { [category]: item_id }.
export async function getHighlightsFromDB(): Promise<Record<string, string>> {
  return getCachedHighlights();
}

// Compute the effective highlights map, defaulting to the lowest-sortOrder item
// in each category when no persisted highlight exists.
export function computeEffectiveHighlights(
  items: MenuItem[],
  persisted: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = { ...persisted };

  // Collect all categories across all items
  const allCategories = new Set<string>();
  for (const item of items) {
    for (const cat of item.categories) allCategories.add(cat);
  }

  for (const cat of allCategories) {
    if (result[cat]) continue; // already persisted

    // Default: lowest sortOrder item in this category
    const categoryItems = items
      .filter((i) => i.categories.includes(cat))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (categoryItems.length > 0) {
      result[cat] = categoryItems[0].id;
    }
  }

  return result;
}
