"use client";

import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const handleWebVitals: ReportWebVitalsCallback = (metric) => {
  // Dev-mode: log all metrics and warn on slow LCP
  if (process.env.NODE_ENV === "development") {
    const { name, value, rating } = metric;
    console.log(`[Web Vitals] ${name}: ${Math.round(value)}ms (${rating})`);

    if (name === "LCP" && value > 2500) {
      console.warn(
        `[Web Vitals] LCP is ${Math.round(value)}ms — exceeds 2500ms target. Check largest visible element.`
      );
    }
  }
};

/**
 * Captures LCP, INP, CLS, FCP, and TTFB via the Next.js useReportWebVitals hook.
 * Renders nothing — zero layout impact.
 */
export function WebVitals() {
  useReportWebVitals(handleWebVitals);
  return null;
}
