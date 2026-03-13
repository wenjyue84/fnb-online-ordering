import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/**
 * Build hreflang alternates for a given path segment.
 * @param path - The path after the locale prefix, e.g. "/menu" or "/blog/my-post".
 *               Pass "" or "/" for the home page.
 * @returns An alternates object for use in generateMetadata.
 */
export function buildAlternates(path: string): Metadata["alternates"] {
  // Ensure path starts with "/" and doesn't have trailing slash (except root)
  const normalised = path === "" || path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;

  const languages: Record<string, string> = {
    "x-default": `/en${normalised}`,
  };
  for (const locale of routing.locales) {
    languages[locale] = `/${locale}${normalised}`;
  }

  return {
    languages,
  };
}
