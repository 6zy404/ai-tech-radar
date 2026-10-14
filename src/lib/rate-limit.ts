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

// Client identity for rate-limit buckets.
//
// Order matters, and it was wrong once (2026-09-24). The site is served through
// a Cloudflare Tunnel, and Cloudflare *appends* to an `X-Forwarded-For` the
// client already sent rather than replacing it — so the first hop of that
// header is whatever the caller chose, and rotating it gave a fresh bucket per
// request. The header Cloudflare sets itself is `CF-Connecting-IP`, so that is
// read first. `X-Forwarded-For` is read from its *last* hop for the same
// reason: the last entry is the address the trusted proxy in front of us saw.
// This is still a fair-use key, not an identity check: anything that reaches
// the server without going through the proxy can set every one of these.
export function getRateLimitClientKey(headers: Headers): string {
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();

  if (cloudflareIp) {
    return toRateLimitBucket(cloudflareIp);
  }

  const realIp = headers.get("x-real-ip")?.trim();

  if (realIp) {
    return toRateLimitBucket(realIp);
  }

  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    const lastHop = hops[hops.length - 1];

    if (lastHop) {
      return toRateLimitBucket(lastHop);
    }
  }

  // Local runs have no proxy headers at all, so every caller shares one bucket.
  // That is intentional: the limit still bounds total provider calls per window.
  return "unknown-client";
}

// One bucket per IPv6 /64. The site has AAAA records, and an ordinary IPv6
// subscriber holds a whole /64 — 2^64 addresses, each a fresh bucket if the
// key were the full address. IPv4, and IPv4 written as `::ffff:a.b.c.d`, keep
// the full address. Anything that does not parse as IPv6 is returned as is.
export function toRateLimitBucket(address: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);

  if (mapped) {
    return mapped[1];
  }

  if (!address.includes(":")) {
    return address;
  }

  // Drop a zone id (fe80::1%eth0); expand "::" to the zeros it stands for.
  const [head, tail, ...rest] = address.split("%")[0].split("::");

  if (rest.length > 0) {
    return address;
  }

  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = 8 - left.length - right.length;
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(Math.max(zeros, 0)).fill("0"), ...right];

  if (
    (tail !== undefined && zeros < 1) ||
    groups.length !== 8 ||
    !groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))
  ) {
    return address;
  }

  const expanded = groups.map((group) => group.toLowerCase().padStart(4, "0"));

  // IPv4-mapped written in hex (::ffff:c000:201): one IPv4 client, full key.
  if (
    expanded.slice(0, 5).every((group) => group === "0000") &&
    expanded[5] === "ffff"
  ) {
    return address;
  }

  return `${expanded.slice(0, 4).join(":")}::/64`;
}
