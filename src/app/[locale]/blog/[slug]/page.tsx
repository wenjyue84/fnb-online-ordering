import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBlogPost, getBlogSlugs } from "@/lib/blog";
import { PostContent } from "@/components/blog/post-content";
import { BlogInlineEditor } from "@/components/admin/blog-inline-editor";
import { Link } from "@/i18n/navigation";
import { BlogPostJsonLd } from "@/components/seo/json-ld";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Not Found" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      ...(post.coverImage && { images: [post.coverImage] }),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getBlogPost(slug);
  const t = await getTranslations({ locale, namespace: "common" });

  if (!post) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <BlogPostJsonLd
        title={post.title}
        description={post.excerpt}
        datePublished={post.publishedAt ?? ""}
        url={`${siteUrl}/${locale}/blog/${slug}`}
        image={post.coverImage}
      />
      <Link
        href="/blog"
        className="mb-6 inline-flex text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; {t("backToBlog")}
      </Link>

      <header className="mb-8">
        {!isAdmin && (
          <h1 className="text-3xl font-bold lg:text-4xl">{post.title}</h1>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {post.publishedAt && (
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {post.coverImage && (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-xl">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      {isAdmin ? (
        <BlogInlineEditor post={post} />
      ) : (
        <PostContent content={post.content} />
      )}
    </article>
  );
}
