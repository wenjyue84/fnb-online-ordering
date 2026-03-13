/**
 * Smoke test report generator — SPIRAL-compatible
 * Hits localhost:3031 and writes test-reports/<timestamp>/report.json
 *
 * Usage: node scripts/generate-test-report.mjs
 * Requires: npm run dev (server must be running on port 3031)
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3031";

const SMOKE_TESTS = [
  { name: "GET /en (home page)", url: `${BASE_URL}/en`, expectedStatus: 200 },
  { name: "GET /en/menu (menu page)", url: `${BASE_URL}/en/menu`, expectedStatus: 200 },
  { name: "GET /api/settings (public settings)", url: `${BASE_URL}/api/settings`, expectedStatus: 200 },
];

async function runTest(test) {
  const start = Date.now();
  try {
    const res = await fetch(test.url, { signal: AbortSignal.timeout(10000) });
    const duration = Date.now() - start;
    const passed = res.status === test.expectedStatus;
    return {
      name: test.name,
      url: test.url,
      status: passed ? "passed" : "failed",
      expected: test.expectedStatus,
      actual: res.status,
      durationMs: duration,
      error: null,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      name: test.name,
      url: test.url,
      status: "errored",
      expected: test.expectedStatus,
      actual: null,
      durationMs: duration,
      error: err.message,
    };
  }
}

async function main() {
  console.log(`Running ${SMOKE_TESTS.length} smoke tests against ${BASE_URL}...`);

  const tests = [];
  for (const test of SMOKE_TESTS) {
    const result = await runTest(test);
    const icon = result.status === "passed" ? "✓" : result.status === "failed" ? "✗" : "!";
    console.log(`  ${icon} ${result.name} — ${result.status} (${result.durationMs}ms)`);
    if (result.error) console.log(`    Error: ${result.error}`);
    tests.push(result);
  }

  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const errored = tests.filter((t) => t.status === "errored").length;
  const total = tests.length;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: { passed, failed, errored, total },
    tests,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(process.cwd(), "test-reports", timestamp);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${errored} errored / ${total} total`);
  console.log(`Report written to: test-reports/${timestamp}/report.json`);

  if (failed > 0 || errored > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
