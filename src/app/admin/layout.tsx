import type { ReactNode } from "react";
import { headers } from "next/headers";
import "../globals.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      {/* Strip any dark-mode class that may have persisted from a client-side navigation */}
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.remove('dark');`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
