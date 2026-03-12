import sql from "./db";
import { filterByAvailability } from "./availability";
import type { MenuItem, MenuItemWithRules, DisplayCategory } from "@/types/menu";
import { getActiveRules, applyRules } from "./rules";
import { readdirSync } from "fs";
import { join } from "path";

const MENU_IMAGES_DIR = join(process.cwd(), "public", "images", "menu");

/** Cached filesystem scan for primary + secondary photos (5-min TTL) */
let _photosCache: {
  primary: Record<string, string>;
  secondary: Record<string, string[]>;
  ts: number;
} | null = null;
const PHOTOS_CACHE_TTL = 5 * 60 * 1000;

function buildPhotosCache(): { primary: Record<string, string>; secondary: Record<string, string[]> } {
  try {
    const files = readdirSync(MENU_IMAGES_DIR);
    // Use separate maps: descriptive names (newer uploads) take priority over exact names (legacy).
    // '-' (ASCII 45) sorts before '.' (ASCII 46) so descriptive files like {code}-slug.webp appear
    // before {code}.webp in directory order. Without this split, the exactMatch pass would
    // re-override a freshly uploaded descriptive file with the old {code}.webp.
    const primaryExact: Record<string, string> = {};
    const primaryDesc: Record<string, string> = {};
    const secondary: Record<string, string[]> = {};

    for (const file of files) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;

      // Secondary: {code}-{digits}.ext  (index >= 2)
      const secMatch = file.match(/^(.+)-(\d+)\.(jpe?g|png|webp)$/i);
      if (secMatch) {
        const code = secMatch[1];
        const index = parseInt(secMatch[2]);
        if (index >= 2) {
          if (!secondary[code]) secondary[code] = [];
          secondary[code].push(`/images/menu/${file}`);
        }
        continue;
      }

      // Primary descriptive: {POS-code}-{name-starting-with-non-digit}.ext
      // POS codes are short uppercase + digits (e.g. TM03, AC01, LL13) — strict match
      // prevents misidentifying codes with hyphens (e.g. Thai-styled_green_cu.jpg)
      const descMatch = file.match(/^([A-Z]{2,4}\d{1,3})-([^0-9].+)\.(jpe?g|png|webp)$/i);
      if (descMatch) {
        const code = descMatch[1].toUpperCase();
        const ext = file.split(".").pop()!.toLowerCase();
        if (!primaryDesc[code] || ext === "webp") primaryDesc[code] = `/images/menu/${file}`;
        continue;
      }

      // Primary exact: {code}.ext — code may contain hyphens/underscores
      const exactMatch = file.match(/^(.+)\.(jpe?g|png|webp)$/i);
      if (exactMatch) {
        const code = exactMatch[1];
        const ext = file.split(".").pop()!.toLowerCase();
        if (!primaryExact[code] || ext === "webp") primaryExact[code] = `/images/menu/${file}`;
      }
    }

    // Merge: descriptive wins over exact (descriptive = named upload = most recent)
    const primary = { ...primaryExact, ...primaryDesc };
    for (const code in secondary) secondary[code].sort();
    return { primary, secondary };
  } catch {
    return { primary: {}, secondary: {} };
  }
}

function getPhotosCache() {
  if (_photosCache && Date.now() - _photosCache.ts < PHOTOS_CACHE_TTL) return _photosCache;
  const { primary, secondary } = buildPhotosCache();
  _photosCache = { primary, secondary, ts: Date.now() };
  return _photosCache;
}

function getSecondaryPhotosMap(): Record<string, string[]> {
  return getPhotosCache().secondary;
}

/** Invalidate the photos cache (call after image upload or rename) */
export function invalidatePhotosCache() {
  _photosCache = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMenuItem(row: any, displayCatMap: Record<string, string[]> = {}, primaryPhotosMap: Record<string, string> = {}, secondaryPhotosMap: Record<string, string[]> = {}): MenuItem {
  const code = row.code as string;
  // null when no real image file exists — lets the card show placeholder immediately
  const primary = primaryPhotosMap[code] ?? null;
  const secondary = secondaryPhotosMap[code] ?? [];
  return {
    id: row.id,
    code,
    nameEn: row.name_en,
    nameMs: row.name_ms,
    nameZh: row.name_zh,
    price: Number(row.price),
    description: row.description ?? "",
    dietary: row.dietary ?? [],
    categories: row.categories ?? [],
    displayCategories: displayCatMap[row.id] ?? [],
    available: row.available,
    featured: row.featured,
    photo: primary,
    photos: primary ? [primary, ...secondary] : secondary,
    sortOrder: row.sort_order ?? 0,
    availableDays: row.available_days ?? [],
    timeFrom: row.time_from ?? "",
    timeUntil: row.time_until ?? "",
    specialDates: row.special_dates ?? [],
    imagePosition: row.image_position ?? "50% 50%",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    isSignature: row.is_signature ?? false,
    archived: row.archived ?? false,
  };
}

// Fetch display categories (website-only, not POS)
export async function getDisplayCategories(): Promise<DisplayCategory[]> {
  // Ensure computed display categories exist (idempotent)
  await sql`
    INSERT INTO display_categories (name, sort_order, active)
    VALUES ('Vegetarian', 6, true)
    ON CONFLICT (name) DO NOTHING
  `;
  return sql<DisplayCategory>`
    SELECT * FROM display_categories ORDER BY sort_order ASC, name ASC
  `;
}

// Build a map of item_id → display category names from DB
async function getItemDisplayCategoryMap(): Promise<Record<string, string[]>> {
  const rows = await sql`
    SELECT idc.item_id, dc.name
    FROM item_display_categories idc
    JOIN display_categories dc ON dc.id = idc.display_category_id
    ORDER BY dc.sort_order ASC
  `;
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const id = row.item_id as string;
    const name = row.name as string;
    if (!map[id]) map[id] = [];
    map[id].push(name);
  }
  return map;
}

// Public menu — available items filtered by Malaysia time, with rules applied
export async function getMenuItems(): Promise<MenuItemWithRules[]> {

  const [rows, rules, displayCatMap] = await Promise.all([
    sql`SELECT * FROM menu_items WHERE available = true AND (archived IS NULL OR archived = false) ORDER BY sort_order ASC, name_en ASC`,
    getActiveRules(),
    getItemDisplayCategoryMap(),
  ]);
  const { primary: primaryPhotosMap, secondary: secondaryPhotosMap } = getPhotosCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = rows.map((r: any) => rowToMenuItem(r, displayCatMap, primaryPhotosMap, secondaryPhotosMap));
  const withRules = applyRules(items, rules);
  return filterByAvailability(withRules.filter((i) => !i.disabledByRule));
}

// Homepage — featured items, padded to MIN_HIGHLIGHTS with top-sorted items if needed
const MIN_HIGHLIGHTS = 6;

export async function getFeaturedItems(): Promise<MenuItemWithRules[]> {

  const [rows, rules, displayCatMap] = await Promise.all([
    sql`SELECT * FROM menu_items WHERE available = true AND (archived IS NULL OR archived = false) ORDER BY sort_order ASC`,
    getActiveRules(),
    getItemDisplayCategoryMap(),
  ]);
  const { primary: primaryPhotosMap, secondary: secondaryPhotosMap } = getPhotosCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = rows.map((r: any) => rowToMenuItem(r, displayCatMap, primaryPhotosMap, secondaryPhotosMap));
  const withRules = applyRules(items, rules);
  const available = filterByAvailability(withRules.filter((i) => !i.disabledByRule));

  const featured = available.filter((i) => i.featured).slice(0, 8);
  if (featured.length >= MIN_HIGHLIGHTS) return featured;

  // Pad with top-sorted non-featured items to always reach MIN_HIGHLIGHTS
  const featuredIds = new Set(featured.map((i) => i.id));
  const padding = available
    .filter((i) => !featuredIds.has(i.id))
    .slice(0, MIN_HIGHLIGHTS - featured.length);

  return [...featured, ...padding];
}

// Admin — all items, no availability filter
export async function getAllMenuItemsForAdmin(): Promise<MenuItem[]> {

  const [rows, displayCatMap] = await Promise.all([
    sql`SELECT * FROM menu_items ORDER BY sort_order ASC, name_en ASC`,
    getItemDisplayCategoryMap(),
  ]);
  const { primary: primaryPhotosMap, secondary: secondaryPhotosMap } = getPhotosCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => rowToMenuItem(r, displayCatMap, primaryPhotosMap, secondaryPhotosMap));
}

// Admin — all items with rule effects computed (for admin visibility)
export async function getAllMenuItemsWithRulesForAdmin(): Promise<MenuItemWithRules[]> {

  const [rows, rules, displayCatMap] = await Promise.all([
    sql`SELECT * FROM menu_items ORDER BY sort_order ASC, name_en ASC`,
    getActiveRules(),
    getItemDisplayCategoryMap(),
  ]);
  const { primary: primaryPhotosMap, secondary: secondaryPhotosMap } = getPhotosCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return applyRules(rows.map((r: any) => rowToMenuItem(r, displayCatMap, primaryPhotosMap, secondaryPhotosMap)), rules);
}

// Signature dish — the one item marked is_signature=true (used as hero on landing page)
export async function getSignatureDish(): Promise<MenuItem | null> {
  try {
    const rows = await sql`SELECT * FROM menu_items WHERE is_signature = true LIMIT 1`;
    if (!rows[0]) return null;
    const displayCatMap = await getItemDisplayCategoryMap();
    const { primary: primaryPhotosMap, secondary: secondaryPhotosMap } = getPhotosCache();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rowToMenuItem(rows[0] as any, displayCatMap, primaryPhotosMap, secondaryPhotosMap);
  } catch {
    // Column may not exist yet (migration runs on first PATCH)
    return null;
  }
}

// Category list for filter bar and admin
export async function getCategories(): Promise<string[]> {
  const rows = await sql`SELECT name FROM categories ORDER BY sort_order ASC`;
  return rows.map((r: Record<string, unknown>) => r.name as string);
}
