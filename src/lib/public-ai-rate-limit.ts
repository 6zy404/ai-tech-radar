// Shared rate-limit policy for the three public AI routes
// (POST /api/technologies/{compare,explain,learning-path}).
//
// These routes are unauthenticated by design (docs/security-boundary.md ->
// "Public LLM Feature Boundary") and are the only public surfaces that can
// trigger an LLM provider call. Per-key caching already bounds how many times
// the same input is generated; this bounds how fast one client can walk through
// *new* inputs.

import {
  createRateLimiter,
  getRateLimitClientKey,
  type RateLimitDecision,
  type RateLimiter
} from "@/lib/rate-limit";

export type PublicAiRouteId = "compare" | "explain" | "learning-path";

const defaultPerMinuteLimit = 10;
const defaultPerHourLimit = 40;

function readLimitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

let limiter: RateLimiter | undefined;

function getLimiter(): RateLimiter {
  if (!limiter) {
    limiter = createRateLimiter([
      {
        limit: readLimitFromEnv(
          "PUBLIC_AI_RATE_LIMIT_PER_MINUTE",
          defaultPerMinuteLimit
        ),
        windowMs: 60_000
      },
      {
        limit: readLimitFromEnv(
          "PUBLIC_AI_RATE_LIMIT_PER_HOUR",
          defaultPerHourLimit
        ),
        windowMs: 3_600_000
      }
    ]);
  }

  return limiter;
}

export const publicAiRateLimitMessage = "请求过于频繁，请稍后再试。";

export function checkPublicAiRateLimit(
  request: Request,
  routeId: PublicAiRouteId
): RateLimitDecision {
  const clientKey = getRateLimitClientKey(request.headers);

  return getLimiter().check(`${routeId}:${clientKey}`);
}

// Test/ops helper: drops all tracked windows. Not called by any route.
export function resetPublicAiRateLimit(): void {
  limiter = undefined;
}
