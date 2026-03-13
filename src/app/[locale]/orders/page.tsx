import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderHistoryClient } from "./order-history-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orderHistoryPage" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${locale}/orders`,
      ...buildAlternates("/orders"),
    },
  };
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OrderHistoryClient />;
}
