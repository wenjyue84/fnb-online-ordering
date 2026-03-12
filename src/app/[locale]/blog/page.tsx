import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBlogPosts } from "@/lib/blog";
import { PostCard } from "@/components/blog/post-card";
import { FeaturedPost } from "@/components/blog/featured-post";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {isAdmin && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="text-base">✎</span>
          <span>
            <strong>Edit mode</strong> — click Edit on any post to edit its title and content inline.
          </span>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Suspense fallback={<BlogGridSkeleton />}>
        <BlogPostGrid locale={locale} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}

async function BlogPostGrid({
  locale,
  isAdmin,
}: {
  locale: string;
  isAdmin: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = await getBlogPosts(locale);

  if (posts.length === 0) {
    return (
      <p className="py-20 text-center text-muted-foreground">
        {t("noPosts")}
      </p>
    );
  }

  const [featuredPost, ...otherPosts] = posts;

  return (
    <>
      <div className="mb-10">
        <FeaturedPost post={featuredPost} isAdmin={isAdmin} />
      </div>

      {otherPosts.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {otherPosts.map((post) => (
            <PostCard key={post.id} post={post} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </>
  );
}

function BlogGridSkeleton() {
  return (
    <>
      {/* Featured post skeleton — aspect-[16/7] matches FeaturedPost component */}
      <div className="mb-10 overflow-hidden rounded-xl border border-border">
        <div className="aspect-[16/7] animate-pulse bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20" />
        <div className="space-y-3 p-6">
          <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Post grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border">
            <div className="aspect-[16/9] animate-pulse bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
