import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/en/admin/",
          "/ms/admin/",
          "/zh/admin/",
          "/kds/",
          "/_next/data/",
        ],
      },
      {
        userAgent: [
          "GPTBot",
          "anthropic-ai",
          "CCBot",
          "ChatGPT-User",
          "Google-Extended",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
