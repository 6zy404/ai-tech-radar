import { NextResponse } from "next/server";

import { guardPushRequest } from "@/lib/push-request-guard";
import {
  parsePushUnsubscribeInput,
  removePushSubscription,
  updatePushSubscriptionStore
} from "@/lib/push-subscriptions";

/**
 * POST /api/push/unsubscribe — deletes one reader's push subscription. The
 * caller presents the endpoint and its auth secret, which only the browser
 * holding the subscription has. Answers `{ removed }` and nothing else; works
 * even when push has since been switched off server-side, so a reader can
 * always remove their record.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardPushRequest(request, "push-unsubscribe");

  if (!guard.ok) {
    return guard.response;
  }

  const parsed = parsePushUnsubscribeInput(guard.body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const removed = updatePushSubscriptionStore((store) => {
    const next = removePushSubscription(
      store,
      parsed.value.endpoint,
      parsed.value.auth,
      new Date().toISOString()
    );

    return { store: next.store, result: next.removed };
  });

  return NextResponse.json(
    { removed },
    { headers: { "Cache-Control": "no-store" } }
  );
}
