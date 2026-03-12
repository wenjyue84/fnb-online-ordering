/**
 * SPIRAL-compatible test runner
 * Runs vitest unit tests and outputs test-reports/<timestamp>/report.json
 * in the format expected by SPIRAL's check_done.py.
 *
 * Usage: node scripts/run-tests.mjs
 *   (Used as SPIRAL_VALIDATE_CMD)
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join(process.cwd(), "test-reports", timestamp);
const outPath = join(outDir, "report.json");

// Run vitest with JSON reporter
const result = spawnSync(
  "npx",
  ["vitest", "run", "--reporter=json"],
  { encoding: "utf-8", shell: true, cwd: process.cwd() }
);

let vitestJson;
try {
  // vitest --reporter=json writes to stdout
  vitestJson = JSON.parse(result.stdout);
} catch {
  // If JSON parse fails, treat all tests as errored
  console.error("[run-tests] Failed to parse vitest JSON output:", result.stderr?.slice(0, 500));
  vitestJson = {
    numPassedTests: 0,
    numFailedTests: 0,
    numTotalTests: 1,
    success: false,
    testResults: [],
  };
}

const passed = vitestJson.numPassedTests ?? 0;
const failed = vitestJson.numFailedTests ?? 0;
const total = vitestJson.numTotalTests ?? 0;
// vitest doesn't distinguish "errored" from "failed", but if we got no results at all, flag it
const errored = (!vitestJson.success && failed === 0 && total === 0) ? 1 : 0;
const passRate = total > 0 ? `${Math.round((passed / total) * 100)}%` : "0%";

// Convert vitest testResults to SPIRAL test array
const tests = (vitestJson.testResults ?? []).flatMap((suite) =>
  (suite.assertionResults ?? []).map((t) => ({
    name: t.fullName ?? t.title,
    suite: suite.name ?? "",
    status: t.status === "passed" ? "passed" : t.status === "failed" ? "failed" : "errored",
    durationMs: Math.round(t.duration ?? 0),
    error: t.failureMessages?.[0] ?? null,
  }))
);

const report = {
  generatedAt: new Date().toISOString(),
  runner: "vitest",
  summary: { passed, failed, errored, total, pass_rate: passRate },
  tests,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));

const icon = failed === 0 && errored === 0 ? "✓" : "✗";
console.log(`${icon} Tests: ${passed}/${total} passed (${passRate}) — report: test-reports/${timestamp}/report.json`);

if (failed > 0 || errored > 0) {
  console.error(`  ${failed} failed, ${errored} errored`);
  process.exit(1);
}
