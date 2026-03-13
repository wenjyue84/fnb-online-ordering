import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, Noto_Sans, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { getSiteSettings } from "@/lib/site-settings";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ChatWidgetLoader } from "@/components/chat/chat-widget-loader";
import { TrayWidget } from "@/components/menu/tray-widget";
import { RestaurantJsonLd } from "@/components/seo/json-ld";
import { OperatingHoursAlert } from "@/components/menu/operating-hours-alert";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { getOperatingStatus } from "@/lib/availability";
import dynamic from "next/dynamic";
const AdminFloatingToolbar = dynamic(() => import("@/components/admin/admin-floating-toolbar").then(m => m.AdminFloatingToolbar));
import "../globals.css";
import { TrayProvider } from "@/lib/tray-context";
import { ScrollingProvider } from "@/lib/scrolling-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaInit } from "@/components/pwa/pwa-init";
import { InstallBanner } from "@/components/pwa/install-banner";
import { SwUpdateBanner } from "@/components/pwa/sw-update-banner";
import { SplashOnboarding } from "@/components/home/splash-onboarding";
import { WebVitals } from "@/components/analytics/web-vitals";
import { SpeedInsightsWrapper } from "@/components/analytics/speed-insights-wrapper";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const settings = await getSiteSettings();
  const nameMap: Record<string, string> = {
    en: settings.cafeName,
    ms: settings.cafeNameMs,
    zh: settings.cafeNameZh,
  };
  const name = nameMap[locale] || settings.cafeName;
  const tagline = settings.cafeTagline;
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
        "x-default": "/en",
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
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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
  setRequestLocale(locale);

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;
  const opStatus = isAdmin ? "open" : await getOperatingStatus();

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <RestaurantJsonLd nonce={nonce} />
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
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-primary"
              >
                Skip to main content
              </a>
              <div className="flex min-h-screen flex-col">
                <Header />
                <OperatingHoursAlert status={opStatus} />
                <main id="main-content" className="flex-1">{children}</main>
                <Footer />
              </div>
              <ErrorBoundary fallback={null}><ChatWidgetLoader /></ErrorBoundary>
              <ErrorBoundary fallback={null}><TrayWidget /></ErrorBoundary>
              {isAdmin && <AdminFloatingToolbar locale={locale} />}
            </ScrollingProvider>
            <PwaInit />
            <SwUpdateBanner />
            <InstallBanner />
            <SplashOnboarding />
            <WebVitals />
            <SpeedInsightsWrapper />
          </TrayProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
