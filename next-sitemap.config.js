/** @type {import('next-sitemap').IConfig} */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  alternateRefs: [
    { href: `${siteUrl}/en`, hreflang: "en" },
    { href: `${siteUrl}/ms`, hreflang: "ms" },
    { href: `${siteUrl}/zh`, hreflang: "zh" },
  ],
  transform: async (config, path) => {
    // Determine priority and changefreq based on path
    const isMenu = path.includes("/menu");
    const isHome = path === "/en" || path === "/ms" || path === "/zh";

    return {
      loc: path,
      changefreq: isMenu ? "daily" : "weekly",
      priority: isHome ? 1.0 : isMenu ? 0.9 : 0.7,
      lastmod: new Date().toISOString(),
      alternateRefs: config.alternateRefs ?? [],
    };
  },
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
  },
};
