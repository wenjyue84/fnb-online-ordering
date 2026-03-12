"use client";

import { useEffect } from "react";

const messages: Record<string, { title: string; body: string; retry: string }> = {
  en: {
    title: "Something went wrong",
    body: "We're sorry — an unexpected error occurred. Please try again.",
    retry: "Try again",
  },
  ms: {
    title: "Sesuatu telah berlaku",
    body: "Maaf — ralat yang tidak dijangka berlaku. Sila cuba lagi.",
    retry: "Cuba lagi",
  },
  zh: {
    title: "出了点问题",
    body: "抱歉，发生了意外错误。请重试。",
    retry: "重试",
  },
};

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Locale error boundary caught:", error);
  }, [error]);

  // Try to detect locale from the URL
  const locale =
    typeof window !== "undefined"
      ? (window.location.pathname.split("/")[1] || "en")
      : "en";
  const t = messages[locale] || messages.en;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="text-center max-w-md">
        <p className="text-5xl" aria-hidden="true">
          ⚠
        </p>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center rounded-lg bg-orange-600 px-6 py-3 text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        >
          {t.retry}
        </button>
      </div>
    </div>
  );
}
