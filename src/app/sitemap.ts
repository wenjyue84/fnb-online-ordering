import type { MetadataRoute } from "next";
import sql from "@/lib/db";
import { getLocalSlugs } from "@/lib/blog-local";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";

const LOCALES = ["en", "ms", "zh"] as const;

/** ISR — regenerate the sitemap once per day */
export const revalidate = 86400;

/** Build hreflang alternateRefs for a given path (without locale prefix). */
function alternates(path: string) {
  return {
    languages: Object.fromEntries(
      LOCALES.map((loc) => [loc, `${SITE_URL}/${loc}${path}`])
    ),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // ── Static routes ──────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/en`, lastModified: now, changeFrequency: "weekly", priority: 1.0, alternates: alternates("") },
    { url: `${SITE_URL}/en/menu`, lastModified: now, changeFrequency: "daily", priority: 0.9, alternates: alternates("/menu") },
    { url: `${SITE_URL}/en/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates("/about") },
    { url: `${SITE_URL}/en/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates("/contact") },
    { url: `${SITE_URL}/en/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8, alternates: alternates("/blog") },
  ];

  // ── Blog posts from Neon Postgres ──────────────────────────────
  const dbRows = await sql<{ slug: string; published_at: string | null; created_at: string | null }>`
    SELECT slug, published_at, created_at
    FROM blog_posts
    WHERE published = true
  `;

  const blogEntries: MetadataRoute.Sitemap = dbRows.map((row) => {
    const lastmod = row.published_at ?? row.created_at ?? now;
    return {
      url: `${SITE_URL}/en/blog/${row.slug}`,
      lastModified: new Date(lastmod).toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
      alternates: alternates(`/blog/${row.slug}`),
    };
  });

  // ── Blog posts from local markdown (content/blog/*.md) ─────────
  const localSlugs = getLocalSlugs();
  const localEntries: MetadataRoute.Sitemap = localSlugs.map((slug) => ({
    url: `${SITE_URL}/en/blog/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
    alternates: alternates(`/blog/${slug}`),
  }));

  // Deduplicate: DB slugs take priority over local slugs
  const dbSlugs = new Set(dbRows.map((r) => r.slug));
  const dedupedLocal = localEntries.filter(
    (e) => !dbSlugs.has(e.url.split("/blog/")[1])
  );

  return [...staticRoutes, ...blogEntries, ...dedupedLocal];
}
