// Shared rate-limit policy for the public AI routes
// (POST /api/technologies/{compare,explain,learning-path} and POST /api/ask).
//
// These routes are unauthenticated by design (docs/security-boundary.md ->
// "Public LLM Feature Boundary") and are the only public surfaces that can
// trigger an LLM provider call. Per-key caching already bounds how many times
// the same input is generated; this bounds how fast one client can walk through
// *new* inputs. /api/ask has no cache (every question is new), so for it this
// is the whole cost guard, together with its per-round token cap.

import { NextResponse } from "next/server";

import { checkPublicAiDailyCap } from "@/lib/public-ai-daily-cap";
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

// Request-shape guard, checked before the rate limit and the body: it reads
// headers only. Its job is to stop *other websites* from spending this site's
// LLM budget through their visitors' browsers: a `text/plain` POST is a "simple"
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
  // The media type alone, parameters dropped: `text/plain; a=application/json`
  // is still text/plain, which a browser sends cross-origin without preflight.
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (mediaType !== "application/json") {
    return { ok: false, status: 415, message: publicAiContentTypeMessage };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (fetchSite === "cross-site") {
    return { ok: false, status: 403, message: publicAiCrossSiteMessage };
  }

  // An Origin header that is present but names no host — a sandboxed iframe
  // sends the literal `null` — is a browser hiding where it came from, so it
  // counts as cross-site. No Origin at all (curl, scripts) is let through.
  const rawOrigin = request.headers.get("origin");

  if (rawOrigin !== null) {
    const originHost = hostOf(rawOrigin);
    const allowedHosts = new Set<string>();
    const requestHost = request.headers.get("host")?.toLowerCase();
    const urlHost = hostOf(request.url);
    const siteHost = hostOf(process.env.NEXT_PUBLIC_SITE_URL);

    for (const host of [requestHost, urlHost, siteHost]) {
      if (host) {
        allowedHosts.add(host);
      }
    }

    if (!originHost || !allowedHosts.has(originHost)) {
      return { ok: false, status: 403, message: publicAiCrossSiteMessage };
    }
  }

  return { ok: true };
}

export const publicAiInvalidBodyMessage = "请求格式不正确。";
export const publicAiBodyTooLargeMessage = "请求内容过大。";

// Body caps. A real compare / explain / learning-path body is a couple of ids;
// /api/ask carries a follow-up's history — up to four earlier questions of at
// most 200 characters, the earlier answers (each one round of at most 700
// tokens; the page sends them whole and the server cuts them to 600
// characters, 2,400 in all) and the `{ ref, key }` pairs shown so far — which
// 64KB covers with room to spare. Without a cap a route read any body into
// memory before parsing it.
export const publicAiMaxBodyBytes: Record<PublicAiRouteId, number> = {
  compare: 16 * 1024,
  explain: 16 * 1024,
  "learning-path": 16 * 1024,
  ask: 64 * 1024
};

export type JsonBodyOutcome =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413; message: string };

// Reads a JSON body no larger than `maxBytes`: a declared Content-Length over
// the cap is refused unread, and the stream is counted as it arrives, so a
// body sent without a length (or with a false one) is cut off at the cap too.
export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<JsonBodyOutcome> {
  const tooLarge = {
    ok: false,
    status: 413,
    message: publicAiBodyTooLargeMessage
  } as const;
  const declared = Number(request.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > maxBytes) {
    return tooLarge;
  }

  const decoder = new TextDecoder();
  let text = "";
  let total = 0;

  if (request.body) {
    const reader = request.body.getReader();

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return tooLarge;
      }

      text += decoder.decode(value, { stream: true });
    }
  }

  try {
    text += decoder.decode();

    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, message: publicAiInvalidBodyMessage };
  }
}

export type PublicAiGuardOutcome =
  { ok: true; body: unknown } | { ok: false; response: NextResponse };

// The opening every public AI route shares, in the order that matters: the
// request-shape guard first (headers only, so a refused cross-site request
// does not spend the visitor's budget), then the per-client rate limit (so a
// spent budget costs nothing, not even a body read), then the site-wide daily
// cap (2026-10-20; after the per-client limit, so one address burning the
// day's budget is stopped by its own bucket first and a refused cross-site
// call never counts), then the size-capped JSON body. Until 2026-09-28 each of
// the four routes carried its own copy of these lines; one function means a
// fifth route cannot get the order wrong or leave a step out.
export async function guardPublicAiRequest(
  request: Request,
  routeId: PublicAiRouteId
): Promise<PublicAiGuardOutcome> {
  const origin = checkPublicAiRequestOrigin(request);

  if (!origin.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: origin.message },
        { status: origin.status }
      )
    };
  }

  const rateLimit = checkPublicAiRateLimit(request, routeId);

  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: publicAiRateLimitMessage },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
        }
      )
    };
  }

  // The cap only reads here; the call is counted where it is certain to
  // happen (public-ai-daily-cap.ts), so a cache hit never spends the budget.
  const dailyCap = checkPublicAiDailyCap();

  if (!dailyCap.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: publicAiRateLimitMessage },
        {
          status: 429,
          headers: { "Retry-After": String(dailyCap.retryAfterSeconds) }
        }
      )
    };
  }

  const body = await readJsonBodyWithLimit(
    request,
    publicAiMaxBodyBytes[routeId]
  );

  return body.ok
    ? body
    : {
        ok: false,
        response: NextResponse.json(
          { error: body.message },
          { status: body.status }
        )
      };
}

// Test/ops helper: drops all tracked windows. Not called by any route.
export function resetPublicAiRateLimit(): void {
  limiter = undefined;
}
