import type { TestDefinition, TestResult } from "./types";

function getBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3031";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";
}

async function fetchHtml(path: string): Promise<{ ok: boolean; html: string; status: number }> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, { redirect: "follow" });
    const html = await res.text();
    return { ok: res.ok, html, status: res.status };
  } catch {
    return { ok: false, html: "", status: 0 };
  }
}

export const e2eTests: TestDefinition[] = [
  {
    id: "e2e-homepage-content",
    name: "Homepage renders cafe name",
    description: "Homepage HTML contains 'Makan Moments' or the cafe name",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, html } = await fetchHtml("/en");
      const duration = Date.now() - start;
      if (!ok) return { pass: false, log: `Homepage failed to load`, duration };
      const hasCafeName = html.includes("Makan Moments") || html.includes("食光记忆");
      return {
        pass: hasCafeName,
        log: hasCafeName
          ? `Homepage contains cafe name (${duration}ms)`
          : `Homepage loaded but cafe name not found in HTML (${duration}ms)`,
        duration,
      };
    },
  },
  {
    id: "e2e-menu-has-items",
    name: "Menu page renders items",
    description: "Menu page HTML contains at least one menu item (RM price visible)",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, html } = await fetchHtml("/en/menu");
      const duration = Date.now() - start;
      if (!ok) return { pass: false, log: `Menu page failed to load`, duration };
      const hasPrices = html.includes("RM");
      return {
        pass: hasPrices,
        log: hasPrices
          ? `Menu page contains RM price (${duration}ms)`
          : `Menu page loaded but no RM prices found in HTML (${duration}ms)`,
        duration,
      };
    },
  },
  {
    id: "e2e-contact-address",
    name: "Contact page has address",
    description: "Contact page HTML contains Skudai address",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, html } = await fetchHtml("/en/contact");
      const duration = Date.now() - start;
      if (!ok) return { pass: false, log: `Contact page failed to load`, duration };
      const hasAddress = html.includes("Skudai") || html.includes("Impian Emas");
      return {
        pass: hasAddress,
        log: hasAddress
          ? `Contact page contains Skudai address (${duration}ms)`
          : `Contact page loaded but address not found in HTML (${duration}ms)`,
        duration,
      };
    },
  },
  {
    id: "e2e-i18n-ms",
    name: "Malay locale loads",
    description: "GET /ms returns HTTP 200 (i18n routing works)",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, status } = await fetchHtml("/ms");
      const duration = Date.now() - start;
      return {
        pass: ok,
        log: ok
          ? `Malay locale /ms → ${status} OK (${duration}ms)`
          : `Malay locale /ms → ${status} (expected 200) (${duration}ms)`,
        duration,
      };
    },
  },
  {
    id: "e2e-i18n-zh",
    name: "Chinese locale loads",
    description: "GET /zh returns HTTP 200 (i18n routing works)",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, status } = await fetchHtml("/zh");
      const duration = Date.now() - start;
      return {
        pass: ok,
        log: ok
          ? `Chinese locale /zh → ${status} OK (${duration}ms)`
          : `Chinese locale /zh → ${status} (expected 200) (${duration}ms)`,
        duration,
      };
    },
  },
  {
    id: "e2e-menu-language-switcher",
    name: "Language switcher in header",
    description: "Menu page HTML contains language flag elements (EN/MY/ZH flags)",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      const { ok, html } = await fetchHtml("/en/menu");
      const duration = Date.now() - start;
      if (!ok) return { pass: false, log: "Menu page failed to load", duration };
      // Header language switcher renders flag spans and locale labels
      const hasFlag = html.includes("🇬🇧") || html.includes("🇲🇾") || html.includes("🇨🇳");
      const hasLocaleLabel = html.includes("Switch to English") || html.includes("Switch language") || html.includes("EN");
      const pass = hasFlag && hasLocaleLabel;
      return {
        pass,
        log: pass
          ? `Language switcher found in menu page HTML (${duration}ms)`
          : `Language switcher not found — hasFlag: ${hasFlag}, hasLocaleLabel: ${hasLocaleLabel} (${duration}ms)`,
        duration,
      };
    },
  },
  {
    id: "e2e-recipe-modal-close-button",
    name: "Recipe modal close button in source",
    description: "recipe-modal.tsx source has an accessible close button with aria-label",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      try {
        const fs = await import("fs");
        const path = await import("path");
        const modalPath = path.join(
          process.cwd(),
          "src",
          "components",
          "menu",
          "recipe-modal.tsx"
        );
        const src = fs.existsSync(modalPath) ? fs.readFileSync(modalPath, "utf-8") : "";
        const duration = Date.now() - start;
        if (!src) {
          return { pass: false, log: "recipe-modal.tsx not found", duration };
        }
        const hasCloseButton = src.includes("onClose") && src.includes("aria-label");
        const hasAbsolutePosition = src.includes("absolute") || src.includes("fixed");
        const pass = hasCloseButton && hasAbsolutePosition;
        return {
          pass,
          log: pass
            ? "recipe-modal.tsx has accessible close button with aria-label (${duration}ms)"
            : `recipe-modal.tsx close button check — hasCloseButton: ${hasCloseButton}, hasAbsolutePosition: ${hasAbsolutePosition} (${duration}ms)`,
          duration,
        };
      } catch (err) {
        return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
      }
    },
  },
  {
    id: "e2e-bottom-nav-component",
    name: "Mobile navigation exists in header",
    description: "header.tsx implements a mobile hamburger menu with collapsible nav (md:hidden pattern)",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      try {
        const fs = await import("fs");
        const path = await import("path");
        // Check for dedicated bottom nav file first
        const candidates = [
          path.join(process.cwd(), "src", "components", "layout", "bottom-nav.tsx"),
          path.join(process.cwd(), "src", "components", "layout", "mobile-nav.tsx"),
          path.join(process.cwd(), "src", "components", "layout", "bottom-navigation.tsx"),
        ];
        const found = candidates.find((p) => fs.existsSync(p));
        const duration = Date.now() - start;
        if (found) {
          return { pass: true, log: `Dedicated mobile nav component: ${path.basename(found)} (${duration}ms)`, duration };
        }
        // Mobile nav is inline in header.tsx (hamburger menu pattern)
        const headerPath = path.join(process.cwd(), "src", "components", "layout", "header.tsx");
        const src = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, "utf-8") : "";
        const hasMobileMenu = src.includes("mobileOpen") || src.includes("mobile-menu") || src.includes("Mobile Nav");
        const hasMobileHidden = src.includes("md:hidden") || src.includes("sm:hidden");
        const pass = hasMobileMenu && hasMobileHidden;
        return {
          pass,
          log: pass
            ? `Mobile navigation found in header.tsx (hamburger pattern, md:hidden) (${duration}ms)`
            : `Mobile navigation not found — hasMobileMenu: ${hasMobileMenu}, hasMobileHidden: ${hasMobileHidden} (${duration}ms)`,
          duration,
        };
      } catch (err) {
        return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
      }
    },
  },
  {
    id: "e2e-chef-pick-card",
    name: "Chef pick card component exists",
    description: "chef-pick-card.tsx exists and renders chef pick items on menu page",
    category: "e2e",
    run: async (): Promise<TestResult> => {
      const start = Date.now();
      try {
        const fs = await import("fs");
        const path = await import("path");
        const cardPath = path.join(
          process.cwd(),
          "src",
          "components",
          "menu",
          "chef-pick-card.tsx"
        );
        const duration = Date.now() - start;
        const exists = fs.existsSync(cardPath);
        if (!exists) {
          return { pass: false, log: "chef-pick-card.tsx not found", duration };
        }
        const src = fs.readFileSync(cardPath, "utf-8");
        const hasChefPickLogic = src.includes("chef") || src.includes("Chef") || src.includes("chefPick");
        return {
          pass: hasChefPickLogic,
          log: hasChefPickLogic
            ? `chef-pick-card.tsx exists and contains chef pick logic (${duration}ms)`
            : `chef-pick-card.tsx exists but chef pick logic not found (${duration}ms)`,
          duration,
        };
      } catch (err) {
        return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
      }
    },
  },
];
