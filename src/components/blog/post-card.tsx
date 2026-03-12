"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/types/blog";

interface PostCardProps {
  post: BlogPost;
  isAdmin?: boolean;
}

export function PostCard({ post, isAdmin }: PostCardProps) {
  const locale = useLocale();

  return (
    <div className="relative">
      <Link href={`/blog/${post.slug}`} className="group block">
      <article className="overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
        {post.coverImage && (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
        )}
        <div className="p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <h2 className="text-lg font-semibold group-hover:text-primary">
            {post.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {post.excerpt}
          </p>
          {post.publishedAt && (
            <time
              dateTime={post.publishedAt}
              className="mt-3 block text-xs text-muted-foreground"
            >
              {new Date(post.publishedAt).toLocaleDateString(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          )}
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
