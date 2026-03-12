import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzerFactory from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withBundleAnalyzer = withBundleAnalyzerFactory({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  turbopack: {
    // Fix workspace root detection — prevents Turbopack from selecting parent package-lock.json
    root: ".",
  },
  experimental: {
    // nodeMiddleware is supported in Next.js 15.1+ but not yet typed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    nodeMiddleware: true,
  },
  // When running via WSL2 (portless), redirect .next cache to native Linux fs to avoid NTFS lock issues
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Keep Neon driver out of the Turbopack/webpack bundle — it uses native bindings
  serverExternalPackages: ["@neondatabase/serverless"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    // Mobile-optimized: generate smaller variants for phones (390px, 414px screens)
    deviceSizes: [390, 414, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    localPatterns: [
      { pathname: "/images/**" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP is set dynamically per-request in middleware.ts with a nonce
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
