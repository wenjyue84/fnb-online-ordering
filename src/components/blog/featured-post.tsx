"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/types/blog";

interface FeaturedPostProps {
  post: BlogPost;
  isAdmin?: boolean;
}

export function FeaturedPost({ post, isAdmin }: FeaturedPostProps) {
  const locale = useLocale();

  return (
    <div className="relative">
      <Link href={`/blog/${post.slug}`} className="group block">
        <article className="overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-xl">
          {post.coverImage && (
            <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 900px"
              />
            </div>
          )}
          <div className="p-6 lg:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {tag}
                </span>
              ))}
              {post.publishedAt && (
                <time
                  dateTime={post.publishedAt}
                  className="ml-auto text-xs text-muted-foreground"
                >
                  {new Date(post.publishedAt).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-snug group-hover:text-primary lg:text-3xl">
              {post.title}
            </h2>
            <p className="mt-3 line-clamp-3 text-base text-muted-foreground">
              {post.excerpt}
            </p>
          </div>
        </article>
      </Link>
      {isAdmin && (
        <Link
          href={`/blog/${post.slug}`}
          className="absolute right-3 top-3 rounded-md bg-amber-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-amber-700"
        >
          Edit
        </Link>
      )}
    </div>
  );
}
