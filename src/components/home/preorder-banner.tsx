import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { UtensilsCrossed, Send, PartyPopper } from "lucide-react";

const steps = [
  { icon: UtensilsCrossed, titleKey: "preorderStep1", descKey: "preorderStep1Desc" },
  { icon: Send, titleKey: "preorderStep2", descKey: "preorderStep2Desc" },
  { icon: PartyPopper, titleKey: "preorderStep3", descKey: "preorderStep3Desc" },
] as const;

export async function PreorderBanner() {
  const t = await getTranslations("home");

  return (
    <section className="px-4 py-4 sm:py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6 dark:border-amber-800/50 dark:bg-amber-950/30">
        {/* Header */}
        <div className="mb-5 text-center">
          <h2 className="font-display text-xl font-bold text-amber-900 sm:text-2xl dark:text-amber-200">
            {t("preorderTitle")}
          </h2>
          <p className="mt-1 text-sm text-amber-700 sm:text-base dark:text-amber-300">
            {t("preorderSubtitle")}
          </p>
        </div>

        {/* 3-step flow */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
          {steps.map((step, i) => (
            <div key={i} className="flex sm:flex-1 sm:flex-col sm:items-center">
              {/* Step content */}
              <div className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 dark:bg-amber-800">
                  <step.icon className="h-5 w-5 text-amber-800 dark:text-amber-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {t(step.titleKey)}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t(step.descKey)}
                  </p>
                </div>
              </div>

              {/* Arrow connector — horizontal on desktop, hidden on mobile */}
              {i < steps.length - 1 && (
                <div className="mx-3 hidden text-amber-400 sm:flex sm:flex-1 sm:items-center sm:justify-center dark:text-amber-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/menu"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-orange-500 px-8 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-600 active:bg-orange-700"
          >
            {t("preorderCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
