import { revalidatePath, revalidateTag } from "next/cache";

const LOCALES = ["en", "ms", "zh"] as const;

/** Revalidate ISR cache for a path across all supported locales.
 *  Pass an empty string ("") to revalidate root locale paths (/en, /ms, /zh).
 *  Pass "/menu" to revalidate /en/menu, /ms/menu, /zh/menu, etc.
 */
export function revalidateLocalePaths(path: string): void {
  for (const locale of LOCALES) {
    revalidatePath(`/${locale}${path}`);
  }
}

/** Invalidate all menu-related cached data (menu items, display categories, highlights, rules). */
export function revalidateMenuCache(): void {
  revalidateTag("menu", "default");
}

/** Invalidate all blog-related cached data (posts, slugs). */
export function revalidateBlogCache(): void {
  revalidateTag("blog", "default");
}
