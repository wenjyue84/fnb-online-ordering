import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Leaf, Users, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { AboutInlineEditor, type AboutContent } from "@/components/admin/about-inline-editor";

export const runtime = "nodejs";

const ABOUT_FILE = path.join(process.cwd(), "content", "about.md");

function readAboutContent(
  fallback: Record<string, string>
): AboutContent & { storyContent: string } {
  if (!fs.existsSync(ABOUT_FILE)) {
    return {
      title: fallback.title ?? "",
      subtitle: fallback.subtitle ?? "",
      storyTitle: fallback.storyTitle ?? "",
      storyContent: fallback.storyContent ?? "",
      ambianceTitle: fallback.ambianceTitle ?? "",
      valuesTitle: fallback.valuesTitle ?? "",
      valueQuality: fallback.valueQuality ?? "",
      valueQualityDesc: fallback.valueQualityDesc ?? "",
      valueCommunity: fallback.valueCommunity ?? "",
      valueCommunityDesc: fallback.valueCommunityDesc ?? "",
      valueHalal: fallback.valueHalal ?? "",
      valueHalalDesc: fallback.valueHalalDesc ?? "",
    };
  }

  const raw = fs.readFileSync(ABOUT_FILE, "utf-8");
  const { data, content } = matter(raw);

  return {
    title: String(data.title ?? fallback.title ?? ""),
    subtitle: String(data.subtitle ?? fallback.subtitle ?? ""),
    storyTitle: String(data.storyTitle ?? fallback.storyTitle ?? ""),
    storyContent: content.trim() || String(fallback.storyContent ?? ""),
    ambianceTitle: String(data.ambianceTitle ?? fallback.ambianceTitle ?? ""),
    valuesTitle: String(data.valuesTitle ?? fallback.valuesTitle ?? ""),
    valueQuality: String(data.valueQuality ?? fallback.valueQuality ?? ""),
    valueQualityDesc: String(data.valueQualityDesc ?? fallback.valueQualityDesc ?? ""),
    valueCommunity: String(data.valueCommunity ?? fallback.valueCommunity ?? ""),
    valueCommunityDesc: String(data.valueCommunityDesc ?? fallback.valueCommunityDesc ?? ""),
    valueHalal: String(data.valueHalal ?? fallback.valueHalal ?? ""),
    valueHalalDesc: String(data.valueHalalDesc ?? fallback.valueHalalDesc ?? ""),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });

  const fallback: Record<string, string> = {
    title: t("title"),
    subtitle: t("subtitle"),
    storyTitle: t("storyTitle"),
    storyContent: t("storyContent"),
    ambianceTitle: t("ambianceTitle"),
    valuesTitle: t("valuesTitle"),
    valueQuality: t("valueQuality"),
    valueQualityDesc: t("valueQualityDesc"),
    valueCommunity: t("valueCommunity"),
    valueCommunityDesc: t("valueCommunityDesc"),
    valueHalal: t("valueHalal"),
    valueHalalDesc: t("valueHalalDesc"),
  };

  const content = readAboutContent(fallback);

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  if (isAdmin) {
    return (
      <AboutInlineEditor
        content={content}
        ambianceFeatures={[
          "Corner shop unit",
          "Natural ventilation",
          "Indoor plants",
          "Hand-drawn wall art",
          "Power outlets available",
          "Free WiFi",
        ]}
      />
    );
  }

  const values = [
    {
      icon: Leaf,
      title: content.valueQuality,
      description: content.valueQualityDesc,
    },
    {
      icon: Users,
      title: content.valueCommunity,
      description: content.valueCommunityDesc,
    },
    {
      icon: ShieldCheck,
      title: content.valueHalal,
      description: content.valueHalalDesc,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-display text-3xl font-bold lg:text-4xl">{content.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{content.subtitle}</p>
      </div>

      {/* Cover Page Image */}
      <div className="mb-16">
        <Image
          src="/images/about/cover-page.webp"
          alt="Makan Moments Cafe menu cover page"
          width={1400}
          height={1980}
          className="w-full rounded-2xl shadow-lg"
          priority
        />
      </div>

      {/* Story */}
      <section className="mb-16">
        <div className="mb-1 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Our Story</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <h2 className="mt-5 mb-4 font-display text-2xl font-bold">{content.storyTitle}</h2>
        <p className="max-w-2xl leading-8 text-muted-foreground">{content.storyContent}</p>
      </section>

      {/* Ambiance */}
      <section className="mb-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="mb-6 font-display text-2xl font-bold">{content.ambianceTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Corner shop unit",
                "Natural ventilation",
                "Indoor plants",
                "Hand-drawn wall art",
                "Power outlets available",
                "Free WiFi",
              ].map((feature) => (
                <div
                  key={feature}
                  className="rounded-lg border border-border bg-card p-4 text-sm font-medium"
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>
          <figure className="overflow-hidden rounded-2xl shadow-lg">
            <Image
              src="/images/about/paintings.webp"
              alt="Hand-drawn wall art inside Makan Moments Cafe — original paintings that give the space its soulful, artistic character"
              width={1200}
              height={1600}
              className="w-full object-cover"
            />
            <figcaption className="bg-card px-4 py-2 text-xs text-muted-foreground">
              Original hand-drawn wall art — a signature of our space
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Values */}
      <section>
        <h2 className="mb-6 font-display text-2xl font-bold">{content.valuesTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-3 flex items-center gap-3">
                <value.icon className="h-5 w-5 shrink-0 text-primary" />
                <h3 className="font-semibold">{value.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
