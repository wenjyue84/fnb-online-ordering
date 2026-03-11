import type { TestDefinition, TestResult } from "./types";

function getBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3031";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";
}

async function checkPage(path: string): Promise<TestResult> {
  const start = Date.now();
  const url = `${getBaseUrl()}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const duration = Date.now() - start;
    if (res.ok) {
      return { pass: true, log: `GET ${path} → ${res.status} OK (${duration}ms)`, duration };
    }
    return {
      pass: false,
      log: `GET ${path} → ${res.status} (expected 200) (${duration}ms)`,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return { pass: false, log: `GET ${path} → Error: ${String(err)}`, duration };
  }
}

export const smokeTests: TestDefinition[] = [
  {
    id: "smoke-homepage",
    name: "Homepage loads",
    description: "GET /en returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/en"),
  },
  {
    id: "smoke-menu",
    name: "Menu page loads",
    description: "GET /en/menu returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/en/menu"),
  },
  {
    id: "smoke-blog",
    name: "Blog page loads",
    description: "GET /en/blog returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/en/blog"),
  },
  {
    id: "smoke-contact",
    name: "Contact page loads",
    description: "GET /en/contact returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/en/contact"),
  },
  {
    id: "smoke-about",
    name: "About page loads",
    description: "GET /en/about returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/en/about"),
  },
  {
    id: "smoke-blog-detail",
    name: "Blog detail page loads",
    description: "GET /en/blog/[slug] returns HTTP 200 for a known local post",
    category: "smoke",
    run: () =>
      checkPage(
        "/en/blog/operations-Customer-Satisfaction--Service-Improvement-Post"
      ),
  },
  {
    id: "smoke-admin-login",
    name: "Admin login page loads",
    description: "GET /admin/login returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/admin/login"),
  },
  {
    id: "smoke-admin-chat-settings",
    name: "Admin chat-settings redirects to login",
    description:
      "GET /admin/chat-settings (unauthenticated) follows redirect to login page — HTTP 200",
    category: "smoke",
    run: () => checkPage("/admin/chat-settings"),
  },
  {
    id: "smoke-menu-filter",
    name: "Menu page with category filter loads",
    description: "GET /en/menu?category=Must-Try returns HTTP 200",
    category: "smoke",
    run: () => checkPage("/en/menu?category=Must-Try"),
  },
];
