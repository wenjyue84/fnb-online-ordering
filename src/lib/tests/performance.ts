import type { TestDefinition, TestResult } from "./types";

function getBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3031";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";
}

async function benchmarkApi(path: string, threshold: number): Promise<TestResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${getBaseUrl()}${path}`);
    const ms = Math.round(performance.now() - start);
    if (!res.ok) {
      return {
        pass: false,
        log: `GET ${path} → ${res.status} (expected 200) — could not measure latency`,
        duration: ms,
      };
    }
    if (ms <= threshold) {
      return {
        pass: true,
        log: `${path}: ${ms}ms ✓ (threshold: ${threshold}ms)`,
        duration: ms,
      };
    }
    return {
      pass: false,
      log: `${path}: ${ms}ms ✗ — over threshold of ${threshold}ms`,
      duration: ms,
    };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    return {
      pass: false,
      log: `GET ${path} → Error: ${String(err)}`,
      duration: ms,
    };
  }
}

export const performanceTests: TestDefinition[] = [
  {
    id: "perf-menu-api",
    name: "Menu API < 500ms",
    description: "GET /api/admin/menu responds within 500ms",
    category: "performance",
    run: () => benchmarkApi("/api/admin/menu", 500),
  },
  {
    id: "perf-settings-api",
    name: "Settings API < 200ms",
    description: "GET /api/settings responds within 200ms",
    category: "performance",
    run: () => benchmarkApi("/api/settings", 200),
  },
  {
    id: "perf-highlights-api",
    name: "Highlights API < 300ms",
    description: "GET /api/admin/highlights responds within 300ms",
    category: "performance",
    run: () => benchmarkApi("/api/admin/highlights", 300),
  },
];
