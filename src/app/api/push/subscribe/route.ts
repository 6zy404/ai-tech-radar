import { NextResponse } from "next/server";

import { getAllTags } from "@/lib/content";
import { readPushVapidConfig } from "@/lib/push-config";
import { guardPushRequest } from "@/lib/push-request-guard";
import {
  parsePushSubscriptionInput,
  toPublicPushSubscriptionResult,
  updatePushSubscriptionStore,
  upsertPushSubscription
} from "@/lib/push-subscriptions";

/**
 * POST /api/push/subscribe — saves or updates one reader's push subscription
 * with the topics they follow; an empty topic list deletes it.
 *
 * Body: `{ subscription: PushSubscription.toJSON(), topicIds: string[] }`.
 * Stored: endpoint, keys, topic ids, creation time — nothing from the
 * request itself (no IP, no user agent). The answer carries none of the
 * stored fields. Rate limited and origin-checked before the body is read
 * (src/lib/push-request-guard.ts).
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardPushRequest(request, "push-subscribe");

  if (!guard.ok) {
    return guard.response;
  }

  if (!readPushVapidConfig()) {
    return NextResponse.json(
      { error: "本站暂未开启新信号提醒。" },
      { status: 503 }
    );
  }

  const parsed = parsePushSubscriptionInput(
    guard.body,
    new Set(getAllTags().map((tag) => tag.id))
  );

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const outcome = updatePushSubscriptionStore((store) => {
    const next = upsertPushSubscription(
      store,
      parsed.value,
      new Date().toISOString()
    );

    return { store: next.store, result: next.outcome };
  });

  if (outcome === "conflict") {
    return NextResponse.json({ error: "提醒订阅不匹配。" }, { status: 409 });
  }

  if (outcome === "full") {
    return NextResponse.json(
      { error: "提醒名额已满，请稍后再试。" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    toPublicPushSubscriptionResult(outcome, parsed.value),
    { headers: { "Cache-Control": "no-store" } }
  );
}
