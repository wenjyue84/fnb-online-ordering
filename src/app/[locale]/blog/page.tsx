import type { Metadata } from "next";
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
  const posts = await getBlogPosts(locale);

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  const [featuredPost, ...otherPosts] = posts;

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

      {posts.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">
          {t("noPosts")}
        </p>
      ) : (
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
      )}
    </div>
  );
}
