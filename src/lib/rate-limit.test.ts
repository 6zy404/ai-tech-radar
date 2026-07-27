import { describe, expect, it } from "vitest";

import { createRateLimiter, getRateLimitClientKey } from "@/lib/rate-limit";

const minuteRule = { limit: 3, windowMs: 60_000 };

describe("createRateLimiter", () => {
  it("allows up to the limit and denies the next request in the window", () => {
    const limiter = createRateLimiter([minuteRule]);
    const start = 1_000_000;

    expect(limiter.check("a", start)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check("a", start + 1)).toEqual({
      allowed: true,
      remaining: 1
    });
    expect(limiter.check("a", start + 2)).toEqual({
      allowed: true,
      remaining: 0
    });

    const denied = limiter.check("a", start + 3);

    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSeconds).toBe(60);
    }
  });

  it("lets the window slide so the client recovers without a full reset", () => {
    const limiter = createRateLimiter([minuteRule]);
    const start = 1_000_000;

    limiter.check("a", start);
    limiter.check("a", start + 10_000);
    limiter.check("a", start + 20_000);
    expect(limiter.check("a", start + 30_000).allowed).toBe(false);

    // The first hit falls out of the 60s window; exactly one slot frees up.
    expect(limiter.check("a", start + 60_001).allowed).toBe(true);
    expect(limiter.check("a", start + 60_002).allowed).toBe(false);
  });

  it("does not let a rejected attempt consume or extend the window", () => {
    const limiter = createRateLimiter([minuteRule]);
    const start = 1_000_000;

    limiter.check("a", start);
    limiter.check("a", start + 1);
    limiter.check("a", start + 2);

    // Hammering while blocked must not push the recovery time further out.
    limiter.check("a", start + 30_000);
    limiter.check("a", start + 50_000);

    expect(limiter.check("a", start + 60_001).allowed).toBe(true);
  });

  it("keys clients independently", () => {
    const limiter = createRateLimiter([minuteRule]);
    const start = 1_000_000;

    limiter.check("a", start);
    limiter.check("a", start);
    limiter.check("a", start);

    expect(limiter.check("a", start).allowed).toBe(false);
    expect(limiter.check("b", start).allowed).toBe(true);
  });

  it("enforces every rule, including the longer window", () => {
    const limiter = createRateLimiter([
      { limit: 2, windowMs: 1_000 },
      { limit: 3, windowMs: 60_000 }
    ]);
    const start = 1_000_000;

    limiter.check("a", start);
    limiter.check("a", start + 1);
    // Blocked by the per-second rule.
    expect(limiter.check("a", start + 2).allowed).toBe(false);

    // Per-second window cleared, but the hourly-style budget has one slot left.
    expect(limiter.check("a", start + 2_000).allowed).toBe(true);

    const denied = limiter.check("a", start + 4_000);

    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      // Recovery is governed by the longer window, not the short one.
      expect(denied.retryAfterSeconds).toBe(56);
    }
  });

  it("evicts the least recently seen keys past the tracking cap", () => {
    const limiter = createRateLimiter([{ limit: 1, windowMs: 60_000 }], {
      maxTrackedKeys: 2
    });
    const start = 1_000_000;

    limiter.check("a", start);
    limiter.check("b", start + 1);
    limiter.check("c", start + 2);

    // "a" was evicted, so it starts fresh; "c" is still tracked and blocked.
    expect(limiter.check("a", start + 3).allowed).toBe(true);
    expect(limiter.check("c", start + 4).allowed).toBe(false);
  });

  it("rejects a configuration with no usable rule", () => {
    expect(() => createRateLimiter([])).toThrow();
    expect(() => createRateLimiter([{ limit: 0, windowMs: 1_000 }])).toThrow();
  });
});

describe("getRateLimitClientKey", () => {
  it("prefers the first hop of x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 198.51.100.2",
      "x-real-ip": "198.51.100.2"
    });

    expect(getRateLimitClientKey(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared local bucket", () => {
    expect(
      getRateLimitClientKey(new Headers({ "x-real-ip": "203.0.113.9" }))
    ).toBe("203.0.113.9");
    expect(getRateLimitClientKey(new Headers())).toBe("unknown-client");
  });
});
