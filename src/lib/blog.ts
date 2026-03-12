import sql from "./db";
import { unstable_cache } from "next/cache";
import type { BlogPost } from "@/types/blog";
import { readLocalPosts, getLocalPost, getLocalSlugs } from "./blog-local";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBlogPost(row: any): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    coverImage: row.cover_image || null,
    tags: row.tags ?? [],
    language: row.language ?? "en",
    published: row.published,
    publishedAt: row.published_at
      ? (row.published_at instanceof Date
          ? row.published_at.toISOString().slice(0, 10)
          : String(row.published_at).slice(0, 10))
      : null,
  };
}

function sortByDate(posts: BlogPost[]): BlogPost[] {
  return posts.sort((a, b) => {
    const da = a.publishedAt ?? "";
    const db = b.publishedAt ?? "";
    return db.localeCompare(da); // newest first
  });
}

export async function getBlogPosts(locale?: string): Promise<BlogPost[]> {
  const getCachedPosts = unstable_cache(
    async () => {
      const rows = locale
        ? await sql`SELECT * FROM blog_posts WHERE published = true AND language = ${locale} ORDER BY published_at DESC`
        : await sql`SELECT * FROM blog_posts WHERE published = true ORDER BY published_at DESC`;
      return rows.map(rowToBlogPost);
    },
    ["blog-posts", locale ?? "all"],
    { tags: ["blog"] }
  );
  const sqlPosts = await getCachedPosts();

  // Merge with local markdown posts (filesystem, not cached)
  const localPosts = readLocalPosts();
  const filtered = locale
    ? localPosts.filter((p) => p.language === locale)
    : localPosts;

  return sortByDate([...sqlPosts, ...filtered]);
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  // Check local markdown first (no DB round-trip for local slugs)
  const localPost = getLocalPost(slug);
  if (localPost) return localPost;

  const getCachedPost = unstable_cache(
    async () => {
      const rows = await sql`
        SELECT * FROM blog_posts WHERE slug = ${slug} AND published = true LIMIT 1
      `;
      return rows[0] ? rowToBlogPost(rows[0]) : null;
    },
    ["blog-post", slug],
    { tags: ["blog"] }
  );
  return getCachedPost();
}

export async function getBlogSlugs(): Promise<string[]> {
  const getCachedSlugs = unstable_cache(
    async () => {
      const rows = await sql`SELECT slug FROM blog_posts WHERE published = true`;
      return rows.map((r: Record<string, unknown>) => r.slug as string);
    },
    ["blog-slugs"],
    { tags: ["blog"] }
  );
  const sqlSlugs = await getCachedSlugs();
  const localSlugs = getLocalSlugs();
  return [...sqlSlugs, ...localSlugs];
}

// Admin — all posts including drafts
export async function getAllBlogPostsForAdmin(): Promise<BlogPost[]> {
  const rows = await sql`SELECT * FROM blog_posts ORDER BY created_at DESC`;
  const sqlPosts = rows.map(rowToBlogPost);
  const localPosts = readLocalPosts();
  return sortByDate([...sqlPosts, ...localPosts]);
}
