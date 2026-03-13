import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();

  return {
    name: settings.cafeName,
    short_name: settings.cafeName,
    description: settings.cafeTagline,
    start_url: `/${settings.defaultLocale}`,
    display: "standalone",
    background_color: settings.backgroundColor,
    theme_color: settings.themeColor,
    orientation: "portrait-primary",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["food", "lifestyle"],
    lang: "en",
    dir: "ltr",
  };
}
