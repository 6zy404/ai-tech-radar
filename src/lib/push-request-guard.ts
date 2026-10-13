// The opening of the two public push routes (POST /api/push/subscribe and
// /api/push/unsubscribe), in the same order as the public AI routes: rate
// limit first, then the request-shape guard, then the JSON body.
//
// These routes call no provider, so the budget is about the store, not a
// bill: without a limit one client could fill the subscription file. The
// window is wider than the AI routes' because a reader following several
// topics in a row syncs each change (the client batches them, but a slow
// clicker still makes a few calls a minute). The origin check is the AI
// routes' own `checkPublicAiRequestOrigin` — a cross-site page must not be
// able to subscribe its visitors' browsers here.

import { NextResponse } from "next/server";

import { checkPublicAiRequestOrigin } from "@/lib/public-ai-rate-limit";
import {
  createRateLimiter,
  getRateLimitClientKey,
  type RateLimiter
} from "@/lib/rate-limit";

export type PushRouteId = "push-subscribe" | "push-unsubscribe";

let limiter: RateLimiter | undefined;

function getLimiter(): RateLimiter {
  limiter ??= createRateLimiter([
    { limit: 20, windowMs: 60_000 },
    { limit: 120, windowMs: 3_600_000 }
  ]);

  return limiter;
}

export type PushGuardOutcome =
  { ok: true; body: unknown } | { ok: false; response: NextResponse };

export async function guardPushRequest(
  request: Request,
  routeId: PushRouteId
): Promise<PushGuardOutcome> {
  const decision = getLimiter().check(
    `${routeId}:${getRateLimitClientKey(request.headers)}`
  );

  if (!decision.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "请求过于频繁，请稍后再试。" },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSeconds) }
        }
      )
    };
  }

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

  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "请求格式不正确。" },
        { status: 400 }
      )
    };
  }
}

export function resetPushRateLimit(): void {
  limiter = undefined;
}
