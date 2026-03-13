import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Neon DB module (imports server-only) before importing notifications
vi.mock("@/lib/db", () => ({
  default: vi.fn(),
}));

import { withRetry } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// withRetry — exponential backoff retry helper
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result on first successful call", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on the second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on failure and succeeds on the third attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    await vi.advanceTimersByTimeAsync(250);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // Use real timers for exhaustion tests to avoid unhandled rejection warnings
  it("throws after all retries are exhausted", async () => {
    vi.useRealTimers();

    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      throw new Error("persistent-fail");
    });

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })
    ).rejects.toThrow("persistent-fail");

    expect(callCount).toBe(3);
  });

  it("uses exponential backoff delays", async () => {
    const timestamps: number[] = [];
    const fn = vi.fn().mockImplementation(() => {
      timestamps.push(Date.now());
      if (timestamps.length < 3) {
        return Promise.reject(new Error("fail"));
      }
      return Promise.resolve("ok");
    });

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 1000 });

    // First call happens immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // First retry after 1000ms (1000 * 2^0)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry after 2000ms (1000 * 2^1)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe("ok");
  });

  it("defaults to maxRetries=3 when not specified", async () => {
    vi.useRealTimers();

    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      throw new Error("fail");
    });

    await expect(
      withRetry(fn, { baseDelayMs: 10 })
    ).rejects.toThrow("fail");

    expect(callCount).toBe(3);
  });

  it("works with maxRetries=1 (no retries)", async () => {
    vi.useRealTimers();

    const fn = vi.fn().mockImplementation(async () => {
      throw new Error("fail");
    });

    await expect(
      withRetry(fn, { maxRetries: 1 })
    ).rejects.toThrow("fail");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
