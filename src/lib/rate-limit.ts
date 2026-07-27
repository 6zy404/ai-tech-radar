// Framework-free sliding-window rate limiter.
//
// Deliberately in-memory and per-process: this prototype runs as a single local
// Next.js server, so a Map is enough to bound how often one client can reach a
// cost-bearing route. It is a cost guardrail, not abuse prevention — see
// docs/security-boundary.md for what it does and does not cover.

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export interface RateLimiterOptions {
  // Upper bound on tracked keys, so a flood of distinct client keys cannot grow
  // the map without limit. The least recently seen keys are dropped first.
  maxTrackedKeys?: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitDecision;
  reset(): void;
}

const defaultMaxTrackedKeys = 5000;

function normalizeRules(rules: RateLimitRule[]): RateLimitRule[] {
  const usable = rules.filter(
    (rule) =>
      Number.isFinite(rule.limit) &&
      rule.limit > 0 &&
      Number.isFinite(rule.windowMs) &&
      rule.windowMs > 0
  );

  if (usable.length === 0) {
    throw new Error("createRateLimiter requires at least one usable rule.");
  }

  return usable;
}

export function createRateLimiter(
  rules: RateLimitRule[],
  options: RateLimiterOptions = {}
): RateLimiter {
  const usableRules = normalizeRules(rules);
  const longestWindowMs = Math.max(...usableRules.map((rule) => rule.windowMs));
  const maxTrackedKeys = options.maxTrackedKeys ?? defaultMaxTrackedKeys;
  // Insertion-ordered Map: re-inserting on every hit keeps the oldest-activity
  // key first, so eviction is a plain iteration from the front.
  const hits = new Map<string, number[]>();

  function evictIfNeeded(): void {
    while (hits.size > maxTrackedKeys) {
      const oldestKey = hits.keys().next();

      if (oldestKey.done) {
        return;
      }

      hits.delete(oldestKey.value);
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitDecision {
      const previous = hits.get(key) ?? [];
      const recent = previous.filter(
        (timestamp) => now - timestamp < longestWindowMs
      );

      for (const rule of usableRules) {
        const inWindow = recent.filter(
          (timestamp) => now - timestamp < rule.windowMs
        );

        if (inWindow.length >= rule.limit) {
          // Keep the pruned list so an over-limit client does not accumulate
          // stale timestamps, but do not record this rejected attempt.
          hits.delete(key);
          hits.set(key, recent);

          const oldestInWindow = inWindow[0];
          const retryAfterMs = oldestInWindow + rule.windowMs - now;

          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
          };
        }
      }

      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      evictIfNeeded();

      const remaining = Math.min(
        ...usableRules.map(
          (rule) =>
            rule.limit -
            recent.filter((timestamp) => now - timestamp < rule.windowMs).length
        )
      );

      return { allowed: true, remaining: Math.max(0, remaining) };
    },
    reset(): void {
      hits.clear();
    }
  };
}

// Client identity for rate-limit buckets. Proxy headers are spoofable, so this
// is a fair-use key, not an identity check: a determined caller can rotate it.
export function getRateLimitClientKey(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();

    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  // Local runs have no proxy headers at all, so every caller shares one bucket.
  // That is intentional: the limit still bounds total provider calls per window.
  return "unknown-client";
}
