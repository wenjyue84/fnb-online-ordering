import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Neon DB module before importing the rate limiter
vi.mock("@/lib/db", () => ({
  default: vi.fn(),
}));

import sql from "@/lib/db";
import { createRateLimiter, checkRateLimit, _resetTableState } from "@/lib/chat/rate-limit";

// sql is a tagged template literal — each call goes through this mock
const mockSql = vi.mocked(sql);

/** Helper: make sql return different values based on the query text */
function setupSqlMock(countForInsert: number) {
  mockSql.mockImplementation((strings: TemplateStringsArray) => {
    const query = strings[0] ?? "";
    if (query.includes("CREATE TABLE")) return Promise.resolve([]) as ReturnType<typeof sql>;
    if (query.includes("DELETE FROM rate_limit_log")) return Promise.resolve([]) as ReturnType<typeof sql>;
    // INSERT ... RETURNING count
    return Promise.resolve([{ count: countForInsert }]) as ReturnType<typeof sql>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetTableState(); // ensure ensureTable() runs fresh for each test
});

// ── createRateLimiter ────────────────────────────────────────────────────────

describe("createRateLimiter", () => {
  it("allows a request when count is below the max", async () => {
    setupSqlMock(1); // first request → count = 1
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: "test" });
    const result = await limiter("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it("blocks a request when count exceeds the max", async () => {
    setupSqlMock(6); // 6th request against max=5
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: "test" });
    const result = await limiter("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(typeof result.retryAfter).toBe("number");
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("allows exactly max requests before blocking (boundary: count === max)", async () => {
    setupSqlMock(5); // 5th request against max=5 → still allowed
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: "test" });
    const result = await limiter("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("exempts localhost from rate limiting without calling the DB", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: "test" });
    const result = await limiter("127.0.0.1");
    expect(result.allowed).toBe(true);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("exempts IPv6 loopback (::1) from rate limiting", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: "test" });
    const result = await limiter("::1");
    expect(result.allowed).toBe(true);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("resets after the window expires (new window_start → count resets to 1)", async () => {
    // Simulate a new window: count starts back at 1
    setupSqlMock(1);
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: "test" });
    const result = await limiter("1.2.3.4");
    expect(result.allowed).toBe(true);
  });
});

// ── checkRateLimit (chat dual-window) ────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows a chat request when both per-minute and per-day counts are below limits", async () => {
    let callCount = 0;
    mockSql.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings[0] ?? "";
      if (query.includes("CREATE TABLE") || query.includes("DELETE FROM")) {
        return Promise.resolve([]) as ReturnType<typeof sql>;
      }
      callCount++;
      // Return count=1 for both minute and day windows
      return Promise.resolve([{ count: 1 }]) as ReturnType<typeof sql>;
    });

    const result = await checkRateLimit("5.6.7.8");
    expect(result.allowed).toBe(true);
    expect(callCount).toBe(2); // one for minute, one for day
  });

  it("blocks chat when per-minute limit is exceeded", async () => {
    mockSql.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings[0] ?? "";
      if (query.includes("CREATE TABLE") || query.includes("DELETE FROM")) {
        return Promise.resolve([]) as ReturnType<typeof sql>;
      }
      return Promise.resolve([{ count: 11 }]) as ReturnType<typeof sql>; // exceeds 10/min
    });

    const result = await checkRateLimit("5.6.7.8");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("blocks chat when per-day limit is exceeded", async () => {
    let insertCallCount = 0;
    mockSql.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings[0] ?? "";
      if (query.includes("CREATE TABLE") || query.includes("DELETE FROM")) {
        return Promise.resolve([]) as ReturnType<typeof sql>;
      }
      insertCallCount++;
      // First increment (minute) passes, second (day) exceeds limit
      const count = insertCallCount === 1 ? 5 : 101;
      return Promise.resolve([{ count }]) as ReturnType<typeof sql>;
    });

    const result = await checkRateLimit("5.6.7.8");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("exempts localhost from chat rate limiting", async () => {
    const result = await checkRateLimit("127.0.0.1");
    expect(result.allowed).toBe(true);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
