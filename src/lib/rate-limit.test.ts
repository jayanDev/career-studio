import { describe, expect, it, vi } from "vitest";

import { consume, rateLimitKey } from "./rate-limit";

describe("consume", () => {
  it("allows up to `limit` requests in a window and 429s the next", () => {
    // Unique key per test so buckets don't bleed between cases.
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 5; i += 1) {
      const r = consume(key, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = consume(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("refills tokens proportionally as time passes", () => {
    const key = `refill:${Math.random()}`;
    const now = Date.now();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      // Drain to zero.
      for (let i = 0; i < 3; i += 1) consume(key, 3, 60_000);
      expect(consume(key, 3, 60_000).allowed).toBe(false);
      // Advance halfway through the window — should grant ~1.5 tokens back.
      vi.setSystemTime(now + 30_000);
      expect(consume(key, 3, 60_000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("isolates buckets by key", () => {
    const k1 = `iso-a:${Math.random()}`;
    const k2 = `iso-b:${Math.random()}`;
    for (let i = 0; i < 2; i += 1) consume(k1, 2, 60_000);
    expect(consume(k1, 2, 60_000).allowed).toBe(false);
    expect(consume(k2, 2, 60_000).allowed).toBe(true);
  });

  it("resets when the limit/window changes for a key", () => {
    const key = `change:${Math.random()}`;
    consume(key, 1, 60_000);
    expect(consume(key, 1, 60_000).allowed).toBe(false);
    // Same key with different parameters → fresh bucket.
    expect(consume(key, 5, 60_000).allowed).toBe(true);
  });
});

describe("rateLimitKey", () => {
  it("prefers userId when present", () => {
    expect(rateLimitKey("ai", { userId: "u-123" })).toBe("ai:user:u-123");
  });

  it("falls back to first x-forwarded-for IP", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    expect(rateLimitKey("ai", { request: req })).toBe("ai:ip:10.0.0.1");
  });

  it("falls back to anon when nothing identifies the caller", () => {
    expect(rateLimitKey("scrape", {})).toBe("scrape:ip:anon");
  });
});
