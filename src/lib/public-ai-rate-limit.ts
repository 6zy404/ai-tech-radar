// Shared rate-limit policy for the public AI routes
// (POST /api/technologies/{compare,explain,learning-path} and POST /api/ask).
//
// These routes are unauthenticated by design (docs/security-boundary.md ->
// "Public LLM Feature Boundary") and are the only public surfaces that can
// trigger an LLM provider call. Per-key caching already bounds how many times
// the same input is generated; this bounds how fast one client can walk through
// *new* inputs. /api/ask has no cache (every question is new), so for it this
// is the whole cost guard, together with its per-round token cap.

import {
  createRateLimiter,
  getRateLimitClientKey,
  type RateLimitDecision,
  type RateLimiter
} from "@/lib/rate-limit";

export type PublicAiRouteId = "compare" | "explain" | "learning-path" | "ask";

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

// Request-shape guard, checked right after the rate limit and before the body
// is read. Its job is to stop *other websites* from spending this site's LLM
// budget through their visitors' browsers: a `text/plain` POST is a "simple"
// cross-origin request that browsers send without a preflight, so any page
// could `fetch()` these routes and every visitor would count as a fresh client.
//
// Requiring `application/json` makes a cross-origin call a preflighted one, and
// these routes send no CORS headers, so the browser refuses it. The
// `Sec-Fetch-Site` / `Origin` checks are belt and braces for the same case.
// None of this stops a script talking to the server directly — that is what
// the per-client rate limit is for.
export type PublicAiRequestDecision =
  { ok: true } | { ok: false; status: 403 | 415; message: string };

export const publicAiCrossSiteMessage = "不支持来自其他站点的请求。";
export const publicAiContentTypeMessage = "请求需要以 JSON 格式提交。";

function hostOf(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function checkPublicAiRequestOrigin(
  request: Request
): PublicAiRequestDecision {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, message: publicAiContentTypeMessage };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (fetchSite === "cross-site") {
    return { ok: false, status: 403, message: publicAiCrossSiteMessage };
  }

  const originHost = hostOf(request.headers.get("origin"));

  if (originHost) {
    const allowedHosts = new Set<string>();
    const requestHost = request.headers.get("host")?.toLowerCase();
    const urlHost = hostOf(request.url);
    const siteHost = hostOf(process.env.NEXT_PUBLIC_SITE_URL);

    for (const host of [requestHost, urlHost, siteHost]) {
      if (host) {
        allowedHosts.add(host);
      }
    }

    if (!allowedHosts.has(originHost)) {
      return { ok: false, status: 403, message: publicAiCrossSiteMessage };
    }
  }

  return { ok: true };
}

// Test/ops helper: drops all tracked windows. Not called by any route.
export function resetPublicAiRateLimit(): void {
  limiter = undefined;
}
