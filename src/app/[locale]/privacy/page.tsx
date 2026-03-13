import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/site-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/privacy`,
      ...buildAlternates("/privacy"),
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold lg:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("lastUpdated")}</p>
      <p className="mt-4 text-muted-foreground">{t("description")}</p>

      {/* Data Controller */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("controllerTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("controllerDesc")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>{settings.cafeName}</li>
          <li>{settings.address}</li>
          <li>{settings.phone}</li>
        </ul>
      </section>

      {/* Data Collected */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("dataCollectedTitle")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("dataCollectedDesc")}
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground space-y-1">
          <li>{t("dataPhone")}</li>
          <li>{t("dataPayment")}</li>
          <li>{t("dataOrder")}</li>
        </ul>
      </section>

      {/* Purpose */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("purposeTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("purposeDesc")}</p>
        <ol className="mt-2 list-inside list-decimal text-sm text-muted-foreground space-y-1">
          <li>{t("purpose1")}</li>
          <li>{t("purpose2")}</li>
          <li>{t("purpose3")}</li>
          <li>{t("purpose4")}</li>
        </ol>
      </section>

      {/* Retention */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("retentionTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("retentionDesc")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground space-y-1">
          <li>{t("retention1")}</li>
          <li>{t("retention2")}</li>
          <li>{t("retention3")}</li>
        </ul>
      </section>

      {/* Rights */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("rightsTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("rightsDesc")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground space-y-1">
          <li>{t("right1")}</li>
          <li>{t("right2")}</li>
          <li>{t("right3")}</li>
          <li>{t("right4")}</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("rightsContact")}
        </p>
      </section>

      {/* Third-Party */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("thirdPartyTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("thirdPartyDesc")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground space-y-1">
          <li>{t("thirdParty1")}</li>
          <li>{t("thirdParty2")}</li>
        </ul>
      </section>

      {/* Cookies */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("cookiesTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("cookiesDesc")}</p>
      </section>

      {/* Changes */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("changesTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("changesDesc")}</p>
      </section>
    </div>
  );
}
