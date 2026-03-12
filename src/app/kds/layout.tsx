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
      <body className="antialiased">{children}</body>
    </html>
  );
}
