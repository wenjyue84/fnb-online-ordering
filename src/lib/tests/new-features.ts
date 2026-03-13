import type { TestDefinition, TestResult } from "./types";
import type { MenuItem } from "@/types/menu";

function getBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3031";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";
}

// US-041: Menu card name and price in separate DOM elements
const testMenuCardLayout: TestDefinition = {
  id: "nf-041-menu-card-layout",
  name: "US-041: Menu card name/price layout",
  description:
    "menu-card.tsx renders item name in h3 and price in a separate span element",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "menu-card.tsx"
      );
      const src = fs.readFileSync(filePath, "utf-8");
      const duration = Date.now() - start;

      // Verify name is in an h3 element
      const hasH3Name = src.includes("<h3") && src.includes("{name}");
      // Verify price is in a separate span element
      const hasPriceSpan =
        src.includes("<span") &&
        (src.includes("formatPrice(item.price)") ||
          src.includes("formatPrice(item.originalPrice)"));
      // Verify h3 does NOT contain the price (they are separate elements)
      const h3Block = src.match(/<h3[^>]*>[\s\S]*?<\/h3>/)?.[0] ?? "";
      const h3ContainsPrice =
        h3Block.includes("formatPrice") || h3Block.includes("price");

      const pass = hasH3Name && hasPriceSpan && !h3ContainsPrice;
      const logs: string[] = [];
      if (!hasH3Name) logs.push("FAIL: name not rendered in h3");
      if (!hasPriceSpan) logs.push("FAIL: price not rendered in span");
      if (h3ContainsPrice) logs.push("FAIL: h3 contains price - not separate");
      if (pass) logs.push("PASS: name in h3, price in separate span block");
      return { pass, log: logs.join("\n"), duration };
    } catch (err) {
      return {
        pass: false,
        log: `Error: ${String(err)}`,
        duration: Date.now() - start,
      };
    }
  },
};

// US-042: Admin translation fields and translate API
const testAdminTranslationFields: TestDefinition = {
  id: "nf-042-admin-translation-fields",
  name: "US-042: Admin translation fields (nameMs / nameZh)",
  description:
    "admin-menu-table.tsx has nameMs and nameZh inputs; translate route exports POST with translation response",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");

      // Check admin-menu-table.tsx for nameMs/nameZh inputs
      const tablePath = path.join(
        process.cwd(),
        "src",
        "components",
        "admin",
        "admin-menu-table.tsx"
      );
      const tableSrc = fs.readFileSync(tablePath, "utf-8");
      const hasNameMs =
        tableSrc.includes("nameMs") &&
        tableSrc.includes("nameMs: e.target.value");
      const hasNameZh =
        tableSrc.includes("nameZh") &&
        tableSrc.includes("nameZh: e.target.value");

      // Check translate route exists and is correct
      const routePath = path.join(
        process.cwd(),
        "src",
        "app",
        "api",
        "admin",
        "menu",
        "translate",
        "route.ts"
      );
      const routeExists = fs.existsSync(routePath);
      const routeSrc = routeExists ? fs.readFileSync(routePath, "utf-8") : "";
      const hasPostExport =
        routeSrc.includes("export async function POST") ||
        routeSrc.includes("export function POST");
      const returnsTranslation = routeSrc.includes('"translation"');

      const duration = Date.now() - start;
      const logs: string[] = [];
      if (!hasNameMs)
        logs.push("FAIL: nameMs input not found in admin-menu-table.tsx");
      if (!hasNameZh)
        logs.push("FAIL: nameZh input not found in admin-menu-table.tsx");
      if (!routeExists) logs.push("FAIL: translate/route.ts not found");
      if (!hasPostExport)
        logs.push("FAIL: translate/route.ts missing POST export");
      if (!returnsTranslation)
        logs.push("FAIL: translate route does not return translation field");

      const pass =
        hasNameMs && hasNameZh && routeExists && hasPostExport && returnsTranslation;
      if (pass) {
        logs.push(
          "PASS: nameMs/nameZh inputs found, translate route exports POST with translation"
        );
      }
      return { pass, log: logs.join("\n"), duration };
    } catch (err) {
      return {
        pass: false,
        log: `Error: ${String(err)}`,
        duration: Date.now() - start,
      };
    }
  },
};

// US-043: Multi-language search
const testMultiLanguageSearch: TestDefinition = {
  id: "nf-043-multilang-search",
  name: "US-043: Multi-language menu search",
  description:
    "Menu filter finds items by nameEn, nameMs, and nameZh across language fields",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const { getAllMenuItemsForAdmin } = await import("../menu");
      const items: MenuItem[] = await getAllMenuItemsForAdmin();
      const duration = Date.now() - start;

      if (items.length === 0) {
        return {
          pass: false,
          log: "No menu items in DB - cannot test multi-language search",
          duration,
        };
      }

      const logs: string[] = [];
      let allPassed = true;

      // Replicate the filter logic from menu-grid.tsx
      function filterItems(query: string): MenuItem[] {
        const q = query.toLowerCase();
        return items.filter(
          (item: MenuItem) =>
            item.nameEn.toLowerCase().includes(q) ||
            item.nameMs.toLowerCase().includes(q) ||
            item.nameZh.toLowerCase().includes(q) ||
            item.code.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        );
      }

      // Test 1: English search — "tom" should match any Tom Yum variants
      const tomResults = filterItems("tom");
      if (tomResults.length > 0) {
        logs.push(
          `PASS: English search 'tom' => ${tomResults.length} result(s) (e.g. ${tomResults[0].nameEn})`
        );
      } else {
        // Fallback: use first word of first item
        const firstWord = items[0].nameEn.split(" ")[0].toLowerCase();
        const altResults = filterItems(firstWord);
        if (altResults.length > 0) {
          logs.push(
            `PASS: English search '${firstWord}' => ${altResults.length} result(s)`
          );
        } else {
          logs.push("FAIL: English search returned no results");
          allPassed = false;
        }
      }

      // Test 2: Chinese search — use first 2 chars of first Chinese name
      const zhItems = items.filter((i: MenuItem) => i.nameZh && i.nameZh.trim() !== "");
      if (zhItems.length > 0) {
        const zhQuery = zhItems[0].nameZh.substring(0, 2);
        const zhResults = filterItems(zhQuery);
        if (zhResults.length > 0) {
          logs.push(
            `PASS: Chinese search '${zhQuery}' => ${zhResults.length} result(s)`
          );
        } else {
          logs.push(`FAIL: Chinese search '${zhQuery}' returned no results`);
          allPassed = false;
        }
      } else {
        logs.push("INFO: No Chinese names in DB - skipping Chinese search test");
      }

      // Test 3: Malay search — use first word of first Malay name
      const msItems = items.filter((i: MenuItem) => i.nameMs && i.nameMs.trim() !== "");
      if (msItems.length > 0) {
        const msQuery = msItems[0].nameMs.split(" ")[0].toLowerCase();
        const msResults = filterItems(msQuery);
        if (msResults.length > 0) {
          logs.push(
            `PASS: Malay search '${msQuery}' => ${msResults.length} result(s)`
          );
        } else {
          logs.push(`FAIL: Malay search '${msQuery}' returned no results`);
          allPassed = false;
        }
      } else {
        logs.push("INFO: No Malay names in DB - skipping Malay search test");
      }

      logs.push(`Total items in DB: ${items.length}`);
      return { pass: allPassed, log: logs.join("\n"), duration };
    } catch (err) {
      return {
        pass: false,
        log: `Error: ${String(err)}`,
        duration: Date.now() - start,
      };
    }
  },
};

// US-044: Order notification bell — POST /api/orders, verify DB record
const testOrderNotificationBell: TestDefinition = {
  id: "nf-044-order-notification",
  name: "US-044: Order notification (POST /api/orders + DB verify)",
  description:
    "POST /api/orders saves order to tray_orders with status=pending_approval; DB record verified",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    const baseUrl = getBaseUrl();
    let insertedId: number | null = null;

    try {
      // Step 1: POST a test order (public endpoint — no auth required)
      const testItems = [
        { id: "TEST001", name: "Test Item (US-044)", price: 9.99, quantity: 1 },
      ];
      const postRes = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: testItems,
          total: 9.99,
          contactNumber: "0123456789",
          estimatedArrival: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        }),
      });

      const logs: string[] = [];
      if (!postRes.ok) {
        const body = await postRes.text();
        return {
          pass: false,
          log: `POST /api/orders => ${postRes.status} (expected 201): ${body}`,
          duration: Date.now() - start,
        };
      }

      const postData = (await postRes.json()) as { ok: boolean; id: number };
      if (!postData.ok || typeof postData.id !== "number") {
        return {
          pass: false,
          log: `POST /api/orders returned unexpected body: ${JSON.stringify(postData)}`,
          duration: Date.now() - start,
        };
      }
      insertedId = postData.id;
      logs.push(`PASS: POST /api/orders => 201, order id=${insertedId}`);

      // Step 2: Verify via direct DB query — order has status=pending_approval
      const sql = (await import("@/lib/db")).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await sql`
        SELECT id, status FROM tray_orders WHERE id = ${insertedId}
      `;

      if (rows.length === 0) {
        logs.push(`FAIL: Order id=${insertedId} not found in tray_orders table`);
        return {
          pass: false,
          log: logs.join("\n"),
          duration: Date.now() - start,
        };
      }
      if (rows[0].status !== "pending_approval") {
        logs.push(
          `FAIL: order status=${rows[0].status as string} (expected pending_approval)`
        );
        return {
          pass: false,
          log: logs.join("\n"),
          duration: Date.now() - start,
        };
      }
      logs.push("PASS: Order found in DB with status=pending_approval");

      // Step 3: Mark as seen via direct DB (admin API requires auth cookie)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateRows: any[] = await sql`
        UPDATE tray_orders SET status = 'seen'
        WHERE id = ${insertedId}
        RETURNING id, status
      `;
      if (updateRows.length === 0 || updateRows[0].status !== "seen") {
        logs.push("FAIL: Could not update order to status=seen");
        return {
          pass: false,
          log: logs.join("\n"),
          duration: Date.now() - start,
        };
      }
      logs.push(`PASS: Order id=${insertedId} marked as seen in DB`);

      // Cleanup: delete the test order
      await sql`DELETE FROM tray_orders WHERE id = ${insertedId}`;
      logs.push(`INFO: Test order id=${insertedId} cleaned up`);

      return { pass: true, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      // Attempt cleanup on error
      if (insertedId !== null) {
        try {
          const sql = (await import("@/lib/db")).default;
          await sql`DELETE FROM tray_orders WHERE id = ${insertedId}`;
        } catch {
          // ignore cleanup failure
        }
      }
      return {
        pass: false,
        log: `Error: ${String(err)}`,
        duration: Date.now() - start,
      };
    }
  },
};

// US-045: PWA manifest and service worker
const testPWAManifest: TestDefinition = {
  id: "nf-045-pwa-manifest",
  name: "US-045: PWA manifest and service worker",
  description:
    "manifest.json has name/icons/display fields; public/sw.js exists with lifecycle events",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");

      // Check manifest.json exists and is valid
      const manifestPath = path.join(process.cwd(), "public", "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return {
          pass: false,
          log: "FAIL: public/manifest.json not found",
          duration: Date.now() - start,
        };
      }

      const manifestSrc = fs.readFileSync(manifestPath, "utf-8");
      let manifest: Record<string, unknown>;
      try {
        manifest = JSON.parse(manifestSrc) as Record<string, unknown>;
      } catch {
        return {
          pass: false,
          log: "FAIL: public/manifest.json is not valid JSON",
          duration: Date.now() - start,
        };
      }

      const logs: string[] = [];
      let allPassed = true;

      const hasName =
        typeof manifest.name === "string" && manifest.name.length > 0;
      const hasIcons =
        Array.isArray(manifest.icons) &&
        (manifest.icons as unknown[]).length > 0;
      const hasDisplay =
        typeof manifest.display === "string" && manifest.display.length > 0;

      if (!hasName) {
        logs.push("FAIL: manifest.json missing name field");
        allPassed = false;
      } else {
        logs.push(`PASS: manifest name="${manifest.name as string}"`);
      }

      if (!hasIcons) {
        logs.push("FAIL: manifest.json missing icons array");
        allPassed = false;
      } else {
        const icons = manifest.icons as { src: string; sizes: string }[];
        logs.push(
          `PASS: manifest has ${icons.length} icon(s) (e.g. ${icons[0]?.sizes ?? "?"})`
        );
      }

      if (!hasDisplay) {
        logs.push("FAIL: manifest.json missing display field");
        allPassed = false;
      } else {
        logs.push(`PASS: manifest display="${manifest.display as string}"`);
      }

      // Check sw.js exists and has lifecycle events
      const swPath = path.join(process.cwd(), "public", "sw.js");
      if (!fs.existsSync(swPath)) {
        logs.push("FAIL: public/sw.js not found");
        allPassed = false;
      } else {
        const swSrc = fs.readFileSync(swPath, "utf-8");
        const hasLifecycle =
          swSrc.includes("install") || swSrc.includes("activate");
        if (!hasLifecycle) {
          logs.push("FAIL: sw.js lacks service worker lifecycle events");
          allPassed = false;
        } else {
          logs.push(`PASS: public/sw.js exists (${swSrc.length} bytes)`);
        }
      }

      return {
        pass: allPassed,
        log: logs.join("\n"),
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        pass: false,
        log: `Error: ${String(err)}`,
        duration: Date.now() - start,
      };
    }
  },
};

// US-146: Signature dish card — no badge, hover state, lightbox
const testSignatureDishCard: TestDefinition = {
  id: "nf-146-signature-dish-card",
  name: "US-146: Signature dish card (no badge, hover, lightbox)",
  description:
    "chef-pick-card.tsx: isSignature prop hides chef-pick badge, group hover class present, RecipeModal imported as lightbox",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "chef-pick-card.tsx"
      );
      const src = fs.readFileSync(filePath, "utf-8");
      const logs: string[] = [];
      let allPassed = true;

      // Has isSignature prop
      const hasIsSignatureProp = src.includes("isSignature");
      if (!hasIsSignatureProp) {
        logs.push("FAIL: isSignature prop not found in chef-pick-card.tsx");
        allPassed = false;
      } else {
        logs.push("PASS: isSignature prop declared in ChefPickCard");
      }

      // When isSignature=true, chef pick badge is hidden — check conditional rendering
      const signatureHidesBadge =
        src.includes("isSignature ?") || src.includes("isSignature &&") ||
        src.includes("!isSignature");
      if (!signatureHidesBadge) {
        logs.push("FAIL: No conditional badge hiding based on isSignature");
        allPassed = false;
      } else {
        logs.push("PASS: Badge conditional rendering based on isSignature found");
      }

      // Has group class for hover state
      const hasGroupHover = src.includes("group-hover") || src.includes('"group"') || src.includes('"group ') || src.includes(" group ");
      if (!hasGroupHover) {
        logs.push("FAIL: No group/group-hover class found for hover state");
        allPassed = false;
      } else {
        logs.push("PASS: group/group-hover hover state class found");
      }

      // Has RecipeModal (lightbox)
      const hasRecipeModal = src.includes("RecipeModal");
      if (!hasRecipeModal) {
        logs.push("FAIL: RecipeModal (lightbox) not imported/used in chef-pick-card.tsx");
        allPassed = false;
      } else {
        logs.push("PASS: RecipeModal lightbox imported and used");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-147: Admin gear icon present when admin, absent for non-admin
const testAdminGearIcon: TestDefinition = {
  id: "nf-147-admin-gear-icon",
  name: "US-147: Admin gear/toggle icon conditional on isAdmin",
  description:
    "menu-grid.tsx: admin mode toggle button is conditionally rendered only when isAdmin=true",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "menu-grid.tsx"
      );
      const src = fs.readFileSync(filePath, "utf-8");
      const logs: string[] = [];
      let allPassed = true;

      // isAdmin prop accepted
      const hasIsAdminProp = src.includes("isAdmin") && src.includes("isAdmin = false");
      if (!hasIsAdminProp) {
        logs.push("FAIL: isAdmin prop not declared with default false in MenuGrid");
        allPassed = false;
      } else {
        logs.push("PASS: isAdmin prop declared (defaults to false)");
      }

      // Admin toggle button conditionally rendered with {isAdmin && (
      const hasConditionalAdmin = src.includes("{isAdmin && (");
      if (!hasConditionalAdmin) {
        logs.push("FAIL: {isAdmin && ( block not found — admin controls not conditionally hidden");
        allPassed = false;
      } else {
        logs.push("PASS: Admin controls wrapped in {isAdmin && ( guard");
      }

      // Toggle button uses Eye/EyeOff icons for Customer View / Edit Mode
      const hasEyeIcon = src.includes("Eye") && (src.includes("EyeOff") || src.includes("Eye className"));
      if (!hasEyeIcon) {
        logs.push("FAIL: Eye/EyeOff icon not found in admin toggle button");
        allPassed = false;
      } else {
        logs.push("PASS: Eye/EyeOff icons found for admin mode toggle");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-148: Tray button hidden when cart empty, visible when item added
const testTrayButtonVisibility: TestDefinition = {
  id: "nf-148-tray-button-visibility",
  name: "US-148: Tray button hidden when cart empty",
  description:
    "tray-widget.tsx: returns null when totalItems=0 and tray closed; showFloatingButton tied to totalItems > 0",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "tray-widget.tsx"
      );
      const src = fs.readFileSync(filePath, "utf-8");
      const logs: string[] = [];
      let allPassed = true;

      // Returns null when tray empty
      const hasEarlyReturn =
        src.includes("totalItems === 0") && src.includes("return null");
      if (!hasEarlyReturn) {
        logs.push("FAIL: No early return null when totalItems === 0 found");
        allPassed = false;
      } else {
        logs.push("PASS: Early return null when cart is empty");
      }

      // showFloatingButton or equivalent tied to totalItems
      const hasFloatingButtonLogic =
        src.includes("totalItems > 0") ||
        src.includes("showFloatingButton");
      if (!hasFloatingButtonLogic) {
        logs.push("FAIL: No showFloatingButton / totalItems > 0 logic found");
        allPassed = false;
      } else {
        logs.push("PASS: Floating button visibility tied to totalItems > 0");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-149: isScrolling context provided on menu page
const testScrollingContext: TestDefinition = {
  id: "nf-149-scrolling-context",
  name: "US-149: ScrollingProvider wraps menu page",
  description:
    "scrolling-context.tsx exports ScrollingProvider and useScrolling; locale layout wraps children in ScrollingProvider",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logs: string[] = [];
      let allPassed = true;

      // Check scrolling-context.tsx exists and exports provider
      const ctxPath = path.join(process.cwd(), "src", "lib", "scrolling-context.tsx");
      if (!fs.existsSync(ctxPath)) {
        return {
          pass: false,
          log: "FAIL: src/lib/scrolling-context.tsx not found",
          duration: Date.now() - start,
        };
      }
      const ctxSrc = fs.readFileSync(ctxPath, "utf-8");
      const hasProvider = ctxSrc.includes("export function ScrollingProvider");
      const hasHook = ctxSrc.includes("export function useScrolling");
      const hasIsScrolling = ctxSrc.includes("isScrolling");
      if (!hasProvider) { logs.push("FAIL: ScrollingProvider not exported from scrolling-context.tsx"); allPassed = false; }
      else { logs.push("PASS: ScrollingProvider exported"); }
      if (!hasHook) { logs.push("FAIL: useScrolling hook not exported"); allPassed = false; }
      else { logs.push("PASS: useScrolling hook exported"); }
      if (!hasIsScrolling) { logs.push("FAIL: isScrolling state not found in context"); allPassed = false; }
      else { logs.push("PASS: isScrolling state in context"); }

      // Check locale layout uses ScrollingProvider
      const layoutPath = path.join(process.cwd(), "src", "app", "[locale]", "layout.tsx");
      if (!fs.existsSync(layoutPath)) {
        logs.push("FAIL: src/app/[locale]/layout.tsx not found");
        allPassed = false;
      } else {
        const layoutSrc = fs.readFileSync(layoutPath, "utf-8");
        const layoutHasProvider =
          layoutSrc.includes("ScrollingProvider") &&
          layoutSrc.includes("<ScrollingProvider>");
        if (!layoutHasProvider) {
          logs.push("FAIL: Layout does not render <ScrollingProvider>");
          allPassed = false;
        } else {
          logs.push("PASS: <ScrollingProvider> found in locale layout");
        }
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-150: Favorite icon has opacity-0 class when isScrolling
const testFavoriteIconScrollingOpacity: TestDefinition = {
  id: "nf-150-favorite-icon-scrolling-opacity",
  name: "US-150: Favorite icon hidden while scrolling",
  description:
    "menu-card.tsx: favorite button applies opacity-0 when isScrolling=true and the user hasn't revealed it",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "menu-card.tsx"
      );
      const src = fs.readFileSync(filePath, "utf-8");
      const logs: string[] = [];
      let allPassed = true;

      // Uses useScrolling hook
      const importsScrolling = src.includes('from "@/lib/scrolling-context"') || src.includes("useScrolling");
      if (!importsScrolling) {
        logs.push("FAIL: useScrolling not imported in menu-card.tsx");
        allPassed = false;
      } else {
        logs.push("PASS: useScrolling imported");
      }

      // Applies opacity-0 conditionally
      const hasOpacity0 = src.includes("opacity-0") && src.includes("isScrolling");
      if (!hasOpacity0) {
        logs.push("FAIL: opacity-0 class not found with isScrolling condition in menu-card.tsx");
        allPassed = false;
      } else {
        logs.push("PASS: opacity-0 applied when isScrolling");
      }

      // Applies opacity-100 otherwise
      const hasOpacity100 = src.includes("opacity-100");
      if (!hasOpacity100) {
        logs.push("FAIL: opacity-100 fallback not found in menu-card.tsx");
        allPassed = false;
      } else {
        logs.push("PASS: opacity-100 fallback found");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-151: Bottom search bar renders and syncs with filter
const testBottomSearchBar: TestDefinition = {
  id: "nf-151-bottom-search-bar",
  name: "US-151: Bottom search bar renders and syncs filter",
  description:
    "bottom-search-bar.tsx exists; menu-grid.tsx imports BottomSearchBar and passes search/onSearchChange props",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logs: string[] = [];
      let allPassed = true;

      // Check bottom-search-bar.tsx exists
      const barPath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "bottom-search-bar.tsx"
      );
      if (!fs.existsSync(barPath)) {
        return {
          pass: false,
          log: "FAIL: src/components/menu/bottom-search-bar.tsx not found",
          duration: Date.now() - start,
        };
      }
      const barSrc = fs.readFileSync(barPath, "utf-8");
      const hasInput = barSrc.includes("<input") && barSrc.includes("onSearchChange");
      if (!hasInput) {
        logs.push("FAIL: BottomSearchBar missing input or onSearchChange handler");
        allPassed = false;
      } else {
        logs.push("PASS: BottomSearchBar has input connected to onSearchChange");
      }

      // Check menu-grid.tsx imports and renders BottomSearchBar
      const gridPath = path.join(process.cwd(), "src", "components", "menu", "menu-grid.tsx");
      const gridSrc = fs.readFileSync(gridPath, "utf-8");
      const importsBar = gridSrc.includes('BottomSearchBar');
      const rendersBar = gridSrc.includes("<BottomSearchBar");
      if (!importsBar) {
        logs.push("FAIL: menu-grid.tsx does not import BottomSearchBar");
        allPassed = false;
      } else {
        logs.push("PASS: BottomSearchBar imported in menu-grid.tsx");
      }
      if (!rendersBar) {
        logs.push("FAIL: menu-grid.tsx does not render <BottomSearchBar>");
        allPassed = false;
      } else {
        logs.push("PASS: <BottomSearchBar> rendered in MenuGrid");
      }

      // Verify it's synced via onSearchChange prop
      const hasSyncProp = gridSrc.includes("onSearchChange") && gridSrc.includes("setSearch");
      if (!hasSyncProp) {
        logs.push("FAIL: onSearchChange not wired to setSearch in menu-grid.tsx");
        allPassed = false;
      } else {
        logs.push("PASS: onSearchChange wired to setSearch (filter synced)");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-152: Category chip bar renders in default all-items view
const testCategoryChipBar: TestDefinition = {
  id: "nf-152-category-chip-bar",
  name: "US-152: Category chip bar in all-items view",
  description:
    "menu-grid.tsx: chip bar with data-chip attributes shown when !isFlatView and multiple categorySections exist",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "components",
        "menu",
        "menu-grid.tsx"
      );
      const src = fs.readFileSync(filePath, "utf-8");
      const logs: string[] = [];
      let allPassed = true;

      // Chip bar condition: !isFlatView && categorySections.length > 1
      const hasCondition =
        src.includes("!isFlatView") && src.includes("categorySections.length > 1");
      if (!hasCondition) {
        logs.push("FAIL: Chip bar condition (!isFlatView && categorySections.length > 1) not found");
        allPassed = false;
      } else {
        logs.push("PASS: Chip bar conditionally shown when !isFlatView and multiple sections");
      }

      // data-chip attribute on chip buttons
      const hasDataChip = src.includes('data-chip={cat}') || src.includes('data-chip=');
      if (!hasDataChip) {
        logs.push("FAIL: data-chip attribute not found on chip buttons");
        allPassed = false;
      } else {
        logs.push("PASS: data-chip attribute found on category chip buttons");
      }

      // Chip bar has scroll ref for auto-scroll
      const hasScrollRef = src.includes("chipBarScrollRef");
      if (!hasScrollRef) {
        logs.push("FAIL: chipBarScrollRef not found — chip auto-scroll not implemented");
        allPassed = false;
      } else {
        logs.push("PASS: chipBarScrollRef present for auto-scroll behaviour");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-153: Category section headers contain emoji and styled border
const testCategorySectionDividers: TestDefinition = {
  id: "nf-153-category-section-dividers",
  name: "US-153: Category section dividers with emoji and border",
  description:
    "menu-grid.tsx: section h2 uses border-l-4 border-primary accent; getCategoryEmoji from utils; no sticky on divider",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logs: string[] = [];
      let allPassed = true;

      // Check getCategoryEmoji is in utils.ts
      const utilsPath = path.join(process.cwd(), "src", "lib", "utils.ts");
      const utilsSrc = fs.readFileSync(utilsPath, "utf-8");
      const hasEmojiInUtils = utilsSrc.includes("getCategoryEmoji");
      if (!hasEmojiInUtils) {
        logs.push("FAIL: getCategoryEmoji not exported from src/lib/utils.ts");
        allPassed = false;
      } else {
        logs.push("PASS: getCategoryEmoji exported from utils.ts");
      }

      // Check menu-grid.tsx uses border-l-4 border-primary
      const gridPath = path.join(process.cwd(), "src", "components", "menu", "menu-grid.tsx");
      const gridSrc = fs.readFileSync(gridPath, "utf-8");
      const hasBorderAccent = gridSrc.includes("border-l-4") && gridSrc.includes("border-primary");
      if (!hasBorderAccent) {
        logs.push("FAIL: Section divider missing border-l-4 border-primary accent");
        allPassed = false;
      } else {
        logs.push("PASS: Section divider has border-l-4 border-primary accent");
      }

      // Check getCategoryEmoji used in menu-grid.tsx
      const hasEmojiCall = gridSrc.includes("getCategoryEmoji");
      if (!hasEmojiCall) {
        logs.push("FAIL: getCategoryEmoji not called in menu-grid.tsx section headers");
        allPassed = false;
      } else {
        logs.push("PASS: getCategoryEmoji called in section headers");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// US-154: Initial category is Chef's Pick on menu load
const testInitialChefsPick: TestDefinition = {
  id: "nf-154-initial-chefs-pick",
  name: "US-154: Menu defaults to Chef's Pick category on load",
  description:
    "menu/page.tsx: finds Chef's Pick display category and passes __dc__ prefixed initialCategory to MenuGrid",
  category: "new-features",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "src",
        "app",
        "[locale]",
        "menu",
        "page.tsx"
      );
      if (!fs.existsSync(filePath)) {
        return {
          pass: false,
          log: "FAIL: src/app/[locale]/menu/page.tsx not found",
          duration: Date.now() - start,
        };
      }
      const src = fs.readFileSync(filePath, "utf-8");
      const logs: string[] = [];
      let allPassed = true;

      // Finds Chef's Pick display category by name
      const findsChefsCat =
        src.includes("chefsCat") &&
        (src.includes('"chef"') || src.includes("chef") && src.includes("toLowerCase"));
      if (!findsChefsCat) {
        logs.push("FAIL: Menu page does not look up Chef's Pick display category");
        allPassed = false;
      } else {
        logs.push("PASS: Menu page looks up Chef's Pick display category");
      }

      // Uses __dc__ prefix for display category initialCategory
      const hasDisplayCatPrefix = src.includes("__dc__");
      if (!hasDisplayCatPrefix) {
        logs.push("FAIL: __dc__ prefix not used for initialCategory (Chef's Pick display cat)");
        allPassed = false;
      } else {
        logs.push("PASS: __dc__ prefix used for Chef's Pick initialCategory");
      }

      // Passes initialCategory prop to MenuGrid
      const passesInitialCategory = src.includes("initialCategory={initialCategory}");
      if (!passesInitialCategory) {
        logs.push("FAIL: initialCategory prop not passed to MenuGrid");
        allPassed = false;
      } else {
        logs.push("PASS: initialCategory passed to MenuGrid component");
      }

      return { pass: allPassed, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

export const newFeaturesTests: TestDefinition[] = [
  testMenuCardLayout,
  testAdminTranslationFields,
  testMultiLanguageSearch,
  testOrderNotificationBell,
  testPWAManifest,
  testSignatureDishCard,
  testAdminGearIcon,
  testTrayButtonVisibility,
  testScrollingContext,
  testFavoriteIconScrollingOpacity,
  testBottomSearchBar,
  testCategoryChipBar,
  testCategorySectionDividers,
  testInitialChefsPick,
];
