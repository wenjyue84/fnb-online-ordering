import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, Noto_Sans, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { CAFE } from "@/lib/constants";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ChatWidgetLoader } from "@/components/chat/chat-widget-loader";
import { TrayWidget } from "@/components/menu/tray-widget";
import { RestaurantJsonLd } from "@/components/seo/json-ld";
import { OperatingHoursAlert } from "@/components/menu/operating-hours-alert";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { getOperatingStatus } from "@/lib/availability";
import { AdminFloatingToolbar } from "@/components/admin/admin-floating-toolbar";
import "../globals.css";
import { TrayProvider } from "@/lib/tray-context";
import { ScrollingProvider } from "@/lib/scrolling-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaInit } from "@/components/pwa/pwa-init";
import { SplashOnboarding } from "@/components/home/splash-onboarding";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-zh",
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false, // only activated when zh locale is active; avoids loading large CJK font for EN/MS
});

// /adapt: viewport-fit=cover handles notches and home indicator on iOS/Android
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return params.then(({ locale }) => {
    const name = CAFE.name[locale as keyof typeof CAFE.name] || CAFE.name.en;
    const tagline =
      CAFE.tagline[locale as keyof typeof CAFE.tagline] || CAFE.tagline.en;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";

    return {
      title: {
        default: `${name} — ${tagline}`,
        template: `%s | ${name}`,
      },
      description: `${name} — Thai-Malaysian fusion cafe in Skudai, Johor. ${tagline}`,
      metadataBase: new URL(siteUrl),
      alternates: {
        canonical: `/${locale}`,
        languages: {
          en: "/en",
          ms: "/ms",
          zh: "/zh",
        },
      },
      openGraph: {
        type: "website",
        locale: locale === "zh" ? "zh_CN" : locale === "ms" ? "ms_MY" : "en_US",
        siteName: name,
        title: `${name} — ${tagline}`,
        description: `Thai-Malaysian fusion cafe in Skudai, Johor. Open daily 11AM-11PM.`,
        images: [{ url: "/images/og-image.jpg", width: 1200, height: 630 }],
      },
      robots: { index: true, follow: true },
      manifest: "/manifest.json",
      icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
      },
    };
  });
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;
  const opStatus = isAdmin ? "open" : getOperatingStatus();

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <RestaurantJsonLd />
        {/* US-076: No-JS fallback — show all scroll-reveal elements if JS is disabled */}
        <noscript>
          <style>{".scroll-reveal{opacity:1!important;transform:none!important;transition:none!important}"}</style>
        </noscript>
      </head>
      <body
        className={`${playfairDisplay.variable} ${notoSans.variable} ${locale === "zh" ? notoSansSC.variable : ""} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TrayProvider>
            <ScrollingProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <OperatingHoursAlert status={opStatus} />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <ErrorBoundary fallback={null}><ChatWidgetLoader /></ErrorBoundary>
              <ErrorBoundary fallback={null}><TrayWidget /></ErrorBoundary>
              {isAdmin && <AdminFloatingToolbar locale={locale} />}
            </ScrollingProvider>
            <PwaInit />
            <SplashOnboarding />
          </TrayProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
