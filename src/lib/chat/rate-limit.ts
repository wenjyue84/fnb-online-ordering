import sql from "@/lib/db";

// Localhost IPs are exempt from rate limiting (test runner, dev tools)
const LOCALHOST_IPS = new Set(["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]);

/** Atomically increment the counter for the given key and return the new count. */
async function incrementCount(
  ip: string,
  endpoint: string,
  windowStart: Date
): Promise<number> {
  const rows = await sql<{ count: number }>`
    INSERT INTO rate_limit_log (ip, endpoint, window_start, count)
    VALUES (${ip}, ${endpoint}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (ip, endpoint, window_start)
    DO UPDATE SET count = rate_limit_log.count + 1
    RETURNING count
  `;
  return Number(rows[0].count);
}

// ── Generic factory ──────────────────────────────────────────────────────────

/**
 * Creates a single-window rate limiter backed by Neon Postgres.
 * Safe across multiple Vercel serverless isolates — state is shared via DB.
 *
 * Table creation is handled by scripts/migrate.mjs (run at deploy time).
 *
 * @example
 * const limiter = createRateLimiter({ windowMs: 60_000, max: 5, name: 'POST /api/orders' });
 * const result = await limiter(ip);
 * if (!result.allowed) return 429;
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  name?: string;
}): (ip: string) => Promise<{ allowed: boolean; retryAfter?: number }> {
  const { windowMs, max, name = "rate-limit" } = options;

  return async function check(
    ip: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    // Exempt localhost — used by the admin test runner and dev tools
    if (LOCALHOST_IPS.has(ip)) return { allowed: true };

    const now = Date.now();
    // Align to nearest window boundary so all requests in the same window share the same key
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const windowEnd = new Date(windowStart.getTime() + windowMs);

    const count = await incrementCount(ip, name, windowStart);

    if (count > max) {
      const retryAfter = Math.ceil((windowEnd.getTime() - now) / 1000);
      console.warn(`[rate-limit] ${name} exceeded for IP: ${ip}`);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  };
}

// ── Backward-compatible export for /api/chat ─────────────────────────────────
// Chat uses a dual-window model (10/min + 100/day) preserved here.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_WINDOW = 10;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 100;

export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (LOCALHOST_IPS.has(ip)) return { allowed: true };

  const now = Date.now();

  // Per-minute check
  const minuteWindowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
  const minuteCount = await incrementCount(ip, "chat:minute", minuteWindowStart);
  if (minuteCount > MAX_PER_WINDOW) {
    const minuteEnd = new Date(minuteWindowStart.getTime() + WINDOW_MS);
    return {
      allowed: false,
      retryAfter: Math.ceil((minuteEnd.getTime() - now) / 1000),
    };
  }

  // Per-day check
  const dayWindowStart = new Date(Math.floor(now / DAILY_WINDOW_MS) * DAILY_WINDOW_MS);
  const dayCount = await incrementCount(ip, "chat:day", dayWindowStart);
  if (dayCount > MAX_PER_DAY) {
    const dayEnd = new Date(dayWindowStart.getTime() + DAILY_WINDOW_MS);
    return {
      allowed: false,
      retryAfter: Math.ceil((dayEnd.getTime() - now) / 1000),
    };
  }

  return { allowed: true };
}
