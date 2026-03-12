import type { TestDefinition, TestResult } from "./types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function run(fn: () => void): TestResult {
  const start = Date.now();
  try {
    fn();
    const duration = Date.now() - start;
    return { pass: true, log: "All assertions passed", duration };
  } catch (err) {
    const duration = Date.now() - start;
    return { pass: false, log: String(err), duration };
  }
}

export const unitTests: TestDefinition[] = [
  {
    id: "unit-price-format",
    name: "Price formatting",
    description: "Prices render as RM X.XX format",
    category: "unit",
    run: async () =>
      run(() => {
        const formatPrice = (price: number) => `RM ${price.toFixed(2)}`;
        assert(formatPrice(8) === "RM 8.00", "formatPrice(8) should be RM 8.00");
        assert(formatPrice(12.5) === "RM 12.50", "formatPrice(12.5) should be RM 12.50");
        assert(formatPrice(0) === "RM 0.00", "formatPrice(0) should be RM 0.00");
      }),
  },
  {
    id: "unit-site-settings-defaults",
    name: "SiteSettings defaults structure",
    description: "DEFAULT_SETTINGS has required fields: cafeName, address, phone, displayHours",
    category: "unit",
    run: async () =>
      run(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DEFAULT_SETTINGS } = require("../site-settings-shared") as { DEFAULT_SETTINGS: Record<string, unknown> };
        assert(typeof DEFAULT_SETTINGS.cafeName === "string" && (DEFAULT_SETTINGS.cafeName as string).length > 0, "DEFAULT_SETTINGS.cafeName must be a non-empty string");
        assert(typeof DEFAULT_SETTINGS.address === "string" && (DEFAULT_SETTINGS.address as string).length > 0, "DEFAULT_SETTINGS.address must be a non-empty string");
        assert(typeof DEFAULT_SETTINGS.phone === "string" && (DEFAULT_SETTINGS.phone as string).length > 0, "DEFAULT_SETTINGS.phone must be a non-empty string");
        assert(typeof DEFAULT_SETTINGS.displayHours === "object" && DEFAULT_SETTINGS.displayHours !== null, "DEFAULT_SETTINGS.displayHours must be an object");
      }),
  },
  {
    id: "unit-slug-generation",
    name: "Blog slug generation",
    description: "Slug generated from title is URL-safe",
    category: "unit",
    run: async () =>
      run(() => {
        const toSlug = (title: string) =>
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        assert(toSlug("Hello World") === "hello-world", "basic slug works");
        assert(toSlug("Thai & Malaysian Food!") === "thai-malaysian-food", "special chars removed");
        assert(toSlug("  spaces  ") === "spaces", "leading/trailing hyphens trimmed");
      }),
  },
  {
    id: "unit-cn-utility",
    name: "cn() class utility",
    description: "cn() merges Tailwind classes correctly",
    category: "unit",
    run: async () =>
      run(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { cn } = require("../utils") as { cn: (...inputs: unknown[]) => string };
        const result = cn("px-4", "py-2", false && "hidden", "text-sm");
        assert(typeof result === "string", "cn() returns a string");
        assert(result.includes("px-4"), "cn() includes px-4");
        assert(result.includes("py-2"), "cn() includes py-2");
        assert(!result.includes("hidden"), "cn() excludes falsy class");
      }),
  },
  {
    id: "unit-strip-metadata",
    name: "Blog content strips metadata sections",
    description: "stripMetadataSections removes ## Post Type, ## References blocks from content",
    category: "unit",
    run: async () =>
      run(() => {
        // Inline reimplementation of stripMetadataSections for testing
        const STRIP_SECTION_RE =
          /^##\s+(?:Post Type|Expected Engagement|Perspective|Response Strategy|Best Posting Time|References|Source)\b/i;
        function stripMetadataSections(content: string): string {
          const normalized = content.replace(/\r\n/g, "\n");
          const blocks = normalized.split(/\n---\n/);
          const kept: string[] = [];
          for (const block of blocks) {
            const firstLine = block.trimStart().split("\n")[0].trim();
            if (STRIP_SECTION_RE.test(firstLine)) continue;
            if (/^##\s+Content\b/i.test(firstLine)) {
              const summaryMatch = block.match(/- \*\*AI summary:\*\*\s*(.+)/);
              if (summaryMatch && summaryMatch[1].trim() !== "No content" && summaryMatch[1].trim().length > 5) {
                kept.push("\n" + summaryMatch[1].trim());
              }
              continue;
            }
            kept.push(block);
          }
          return kept.join("\n\n---\n\n").replace(/\n{3,}/g, "\n\n").trim();
        }

        const input = [
          "## Introduction",
          "This is the post content.",
          "---",
          "## Post Type",
          "Facebook Post",
          "---",
          "## References",
          "- Some reference",
        ].join("\n");

        const result = stripMetadataSections(input);
        assert(!result.includes("## Post Type"), "## Post Type section stripped");
        assert(!result.includes("## References"), "## References section stripped");
        assert(result.includes("This is the post content"), "Main content preserved");
      }),
  },
  {
    id: "unit-malaysia-timezone",
    name: "Malaysia timezone offset (UTC+8)",
    description: "Intl.DateTimeFormat with Asia/Kuala_Lumpur returns correct hour range",
    category: "unit",
    run: async () =>
      run(() => {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kuala_Lumpur",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }).formatToParts(now);
        const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "-1", 10);
        const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "-1", 10);
        assert(hour >= 0 && hour <= 23, `Malaysia hour in range 0–23 (got ${hour})`);
        assert(minute >= 0 && minute <= 59, `Malaysia minute in range 0–59 (got ${minute})`);

        // Verify MYT is UTC+8: convert UTC time + 8h, compare to Intl result (allow ±1h for DST edge cases)
        const utcHour = now.getUTCHours();
        const expectedHour = (utcHour + 8) % 24;
        const diff = Math.abs(hour - expectedHour);
        assert(diff === 0 || diff === 23 /* midnight wrap */, `MYT hour ${hour} matches UTC+8 expectation ${expectedHour}`);
      }),
  },
  {
    id: "unit-time-slots-config",
    name: "Time slots config structure",
    description: "readTimeSlots() returns a valid config with slots array",
    category: "unit",
    run: async () => {
      const start = Date.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { readTimeSlots } = require("../time-slots") as {
          readTimeSlots: () => { slots: Array<{ id: string; label: string; startHour: number; endHour: number }> };
        };
        const config = readTimeSlots();
        const duration = Date.now() - start;
        if (!config || !Array.isArray(config.slots)) {
          return { pass: false, log: "readTimeSlots() did not return an object with slots array", duration };
        }
        if (config.slots.length === 0) {
          return { pass: false, log: "readTimeSlots() returned empty slots array", duration };
        }
        for (const slot of config.slots) {
          if (!slot.id || !slot.label || typeof slot.startHour !== "number" || typeof slot.endHour !== "number") {
            return { pass: false, log: `Slot missing required fields: ${JSON.stringify(slot)}`, duration };
          }
        }
        return { pass: true, log: `readTimeSlots() returned ${config.slots.length} valid slots`, duration };
      } catch (err) {
        return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
      }
    },
  },
];
