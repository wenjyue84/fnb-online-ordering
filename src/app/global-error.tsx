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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#faf9f6" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "28rem" }}>
            <p style={{ fontSize: "3rem", margin: 0 }} aria-hidden="true">
              ⚠
            </p>
            {Object.entries(messages).map(([locale, t]) => (
              <div key={locale} style={{ marginTop: locale === "en" ? "1rem" : "0.75rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
                  {t.title}
                </h2>
                <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
                  {t.body}
                </p>
              </div>
            ))}
            <button
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#ea580c",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {messages.en.retry} / {messages.ms.retry} / {messages.zh.retry}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
