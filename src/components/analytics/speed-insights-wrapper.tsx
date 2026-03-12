import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Speed Insights — zero-config CWV monitoring on Vercel deployments.
 * Lazy-loaded by the package itself; adds no weight to the initial page render.
 */
export function SpeedInsightsWrapper() {
  return <SpeedInsights />;
}
