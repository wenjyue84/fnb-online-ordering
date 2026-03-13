import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/site-settings";
import { MapPin, Clock, Phone, Wifi, Facebook, Instagram, Navigation } from "lucide-react";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import type { ContactContent } from "@/components/admin/contact-inline-editor";
import dynamic from "next/dynamic";
const ContactInlineEditor = dynamic(() => import("@/components/admin/contact-inline-editor").then(m => m.ContactInlineEditor));

export const runtime = "nodejs";

const CONTACT_FILE = path.join(process.cwd(), "content", "contact.md");

function readContactContent(fallback: Record<string, string>): ContactContent {
  if (!fs.existsSync(CONTACT_FILE)) {
    return {
      title: fallback.title ?? "",
      subtitle: fallback.subtitle ?? "",
      address: fallback.address ?? "",
      neighborhood: fallback.neighborhood ?? "",
      phone: fallback.phone ?? "",
      hoursDaily: fallback.hoursDaily ?? "",
      hoursLastOrder: fallback.hoursLastOrder ?? "",
      googleMapsEmbed: fallback.googleMapsEmbed ?? "",
    };
  }

  const raw = fs.readFileSync(CONTACT_FILE, "utf-8");
  const { data } = matter(raw);

  return {
    title: String(data.title ?? fallback.title ?? ""),
    subtitle: String(data.subtitle ?? fallback.subtitle ?? ""),
    address: String(data.address ?? fallback.address ?? ""),
    neighborhood: String(data.neighborhood ?? fallback.neighborhood ?? ""),
    phone: String(data.phone ?? fallback.phone ?? ""),
    hoursDaily: String(data.hoursDaily ?? fallback.hoursDaily ?? ""),
    hoursLastOrder: String(data.hoursLastOrder ?? fallback.hoursLastOrder ?? ""),
    googleMapsEmbed: String(data.googleMapsEmbed ?? fallback.googleMapsEmbed ?? ""),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/contact`,
      ...buildAlternates("/contact"),
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });

  const settings = await getSiteSettings();

  const fallback: Record<string, string> = {
    title: t("title"),
    subtitle: t("subtitle"),
    address: settings.address,
    neighborhood: settings.neighborhood,
    phone: settings.phone,
    hoursDaily: settings.displayHours.daily,
    hoursLastOrder: settings.displayHours.lastOrder,
    googleMapsEmbed: settings.googleMapsEmbed,
  };

  const content = readContactContent(fallback);

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  if (isAdmin) {
    return (
      <ContactInlineEditor
        content={content}
        social={settings.social}
        wifiPassword={t("wifiPassword")}
        cafeName={settings.cafeName}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12">
        <h1 className="font-display text-3xl font-bold lg:text-4xl">{content.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{content.subtitle}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Info cards */}
        <div className="space-y-6">
          {/* Address */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{t("addressTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{content.address}</p>
            <p className="mt-1 text-sm text-muted-foreground">{content.neighborhood}</p>
          </div>

          {/* Hours */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{t("hoursTitle")}</h2>
            </div>
            <p className="text-sm">Daily: {content.hoursDaily}</p>
            <p className="text-sm text-muted-foreground">Last order: {content.hoursLastOrder}</p>
          </div>

          {/* Phone */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{t("phoneTitle")}</h2>
            </div>
            <a
              href={`tel:${content.phone.replace(/[- ]/g, "")}`}
              className="text-sm text-primary hover:underline"
            >
              {content.phone}
            </a>
          </div>

          {/* WiFi */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{t("wifiTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t("wifiPassword")}</p>
          </div>

          {/* Social */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 font-semibold">{t("socialTitle")}</h2>
            <div className="flex gap-3">
              <a
                href={settings.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm min-h-[44px] hover:bg-secondary/80"
              >
                <Facebook className="h-4 w-4" /> Facebook
              </a>
              <a
                href={settings.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm min-h-[44px] hover:bg-secondary/80"
              >
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="space-y-4 print:hidden">
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              src={content.googleMapsEmbed}
              width="100%"
              height="100%"
              style={{ minHeight: "400px", border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map showing Makan Moments Cafe location"
            />
          </div>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(content.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            {t("getDirections")}
          </a>
        </div>
      </div>
    </div>
  );
}
