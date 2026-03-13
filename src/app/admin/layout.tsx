import type { ReactNode } from "react";
import { headers } from "next/headers";
import { SwUpdateBanner } from "@/components/pwa/sw-update-banner";
import "../globals.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      {/* Strip any dark-mode class that may have persisted from a client-side navigation */}
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#b45309" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="MM Staff" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.remove('dark');`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-gray-900">
        <SwUpdateBanner priority="high" />
        {children}
      </body>
    </html>
  );
}
