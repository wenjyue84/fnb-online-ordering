import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteSettings } from "@/lib/site-settings";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: `Kitchen Display | ${settings.cafeName}`,
  };
}

export default function KdsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="MM Kitchen" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
