// 「推送新信号」: one merged notification per subscriber for the signals
// published on a given day that match the topics they follow. Triggered from
// the workspace delivery console only (POST /api/workspace/push); there is no
// schedule, so a push always follows an editor's decision.
//
// A signal is marked pushed once it reached at least one subscriber, and a
// marked signal is never sent again — pressing the button twice on the same
// day sends nothing the second time. A push service answering 404 or 410
// means the reader revoked permission or the browser dropped the
// subscription; that record is deleted.

import { getAllTechnologies } from "@/lib/content";
import { getTodayDateString } from "@/lib/digest-store";
import { readPushVapidConfig, type PushVapidConfig } from "@/lib/push-config";
import { sendWebPush, type WebPushResult } from "@/lib/push-send";
import {
  markTechnologiesPushed,
  readPushSubscriptionStore,
  removePushSubscriptionsById,
  updatePushSubscriptionStore,
  type PushSubscriptionRecord
} from "@/lib/push-subscriptions";
import { siteName } from "@/lib/site-metadata";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";

export interface PushSignal {
  id: string;
  slug: string;
  title: string;
  publishDate: string;
  tags: string[];
}

/** What the service worker receives and shows. Public fields only. */
export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PlannedPushMessage {
  subscriptionId: string;
  technologyIds: string[];
  payload: PushNotificationPayload;
}

export interface PushPlan {
  /** Published that day and not pushed before. */
  candidateIds: string[];
  /** Published that day but already pushed. */
  alreadyPushedIds: string[];
  messages: PlannedPushMessage[];
}

const maxNotificationTitleLength = 60;

function clip(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function buildPushNotificationPayload(
  signals: PushSignal[],
  date: string
): PushNotificationPayload {
  const [first] = signals;
  const firstTitle = clip(first.title, maxNotificationTitleLength);

  if (signals.length === 1) {
    return {
      title: `${siteName} · 你关注的话题有新信号`,
      body: firstTitle,
      url: `/technologies/${first.slug}`,
      tag: `signals-${date}`
    };
  }

  return {
    title: `${siteName} · 你关注的话题有 ${signals.length} 条新信号`,
    body: `「${firstTitle}」等 ${signals.length} 条`,
    url: "/technologies?view=followed",
    tag: `signals-${date}`
  };
}

/** Pure: who gets what. `signals` keeps the caller's order (newest first). */
export function planPushMessages(input: {
  subscriptions: PushSubscriptionRecord[];
  signals: PushSignal[];
  date: string;
  pushedTechnologyIds: string[];
}): PushPlan {
  const pushed = new Set(input.pushedTechnologyIds);
  const ofDay = input.signals.filter(
    (signal) => signal.publishDate === input.date
  );
  const candidates = ofDay.filter((signal) => !pushed.has(signal.id));
  const messages: PlannedPushMessage[] = [];

  for (const subscription of input.subscriptions) {
    const topics = new Set(subscription.topicIds);
    const matched = candidates.filter((signal) =>
      signal.tags.some((tag) => topics.has(tag))
    );

    if (matched.length > 0) {
      messages.push({
        subscriptionId: subscription.id,
        technologyIds: matched.map((signal) => signal.id),
        payload: buildPushNotificationPayload(matched, input.date)
      });
    }
  }

  return {
    candidateIds: candidates.map((signal) => signal.id),
    alreadyPushedIds: ofDay
      .filter((signal) => pushed.has(signal.id))
      .map((signal) => signal.id),
    messages
  };
}

export function getPushSignals(): PushSignal[] {
  return getAllTechnologies().map((technology) => ({
    id: technology.id,
    slug: technology.slug,
    title: getPreferredTechnologyTitle(technology),
    publishDate: technology.publishDate,
    tags: technology.tags
  }));
}

export interface PushRunSummary {
  date: string;
  dryRun: boolean;
  subscriberCount: number;
  candidateSignalCount: number;
  alreadyPushedSignalCount: number;
  /** Subscribers a notification was planned for. */
  plannedCount: number;
  sentCount: number;
  failedCount: number;
  expiredRemovedCount: number;
  /** Signals newly marked as pushed by this run. */
  pushedSignalCount: number;
  /**
   * Failed sends grouped by push service host and reason (`HTTP 403`,
   * `TimeoutError`, ...). The host names the service (fcm.googleapis.com),
   * never a subscription. A run where every send times out usually means the
   * server is not going through the proxy: see docs/editorial-round-playbook.md.
   */
  failures: Array<{ service: string; reason: string; count: number }>;
}

export function getPushServiceHost(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "unknown";
  }
}

function addFailure(
  failures: PushRunSummary["failures"],
  service: string,
  reason: string
): void {
  const existing = failures.find(
    (entry) => entry.service === service && entry.reason === reason
  );

  if (existing) {
    existing.count += 1;
  } else {
    failures.push({ service, reason, count: 1 });
  }
}

export const pushDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export interface RunPushOptions {
  dryRun?: boolean;
  /** Defaults to every published signal; tests pass their own. */
  signals?: PushSignal[];
  vapid?: PushVapidConfig | null;
  send?: (
    target: PushSubscriptionRecord,
    payload: string,
    vapid: PushVapidConfig
  ) => Promise<WebPushResult>;
  concurrency?: number;
}

export class PushNotConfiguredError extends Error {
  constructor() {
    super(
      "推送未配置：缺少 PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY，或两者不匹配。"
    );
    this.name = "PushNotConfiguredError";
  }
}

export async function runPushForDate(
  date: string = getTodayDateString(),
  options: RunPushOptions = {}
): Promise<PushRunSummary> {
  if (!pushDatePattern.test(date)) {
    throw new Error("日期格式应为 YYYY-MM-DD。");
  }

  const store = readPushSubscriptionStore();
  const plan = planPushMessages({
    subscriptions: store.subscriptions,
    signals: options.signals ?? getPushSignals(),
    date,
    pushedTechnologyIds: store.pushedTechnologyIds
  });
  const summary: PushRunSummary = {
    date,
    dryRun: Boolean(options.dryRun),
    subscriberCount: store.subscriptions.length,
    candidateSignalCount: plan.candidateIds.length,
    alreadyPushedSignalCount: plan.alreadyPushedIds.length,
    plannedCount: plan.messages.length,
    sentCount: 0,
    failedCount: 0,
    expiredRemovedCount: 0,
    pushedSignalCount: 0,
    failures: []
  };

  if (options.dryRun) {
    return summary;
  }

  const vapid =
    options.vapid === undefined ? readPushVapidConfig() : options.vapid;

  if (!vapid) {
    throw new PushNotConfiguredError();
  }

  const send =
    options.send ??
    ((
      target: PushSubscriptionRecord,
      payload: string,
      config: PushVapidConfig
    ) => sendWebPush(target, payload, config));
  const byId = new Map(
    store.subscriptions.map((record) => [record.id, record])
  );
  const expiredIds = new Set<string>();
  const deliveredTechnologyIds = new Set<string>();
  const queue = [...plan.messages];
  const workers = Array.from(
    { length: Math.max(1, Math.min(options.concurrency ?? 4, queue.length)) },
    async () => {
      for (let message = queue.shift(); message; message = queue.shift()) {
        const target = byId.get(message.subscriptionId);

        if (!target) {
          continue;
        }

        const result = await send(
          target,
          JSON.stringify(message.payload),
          vapid
        );

        if (result.ok) {
          summary.sentCount += 1;
          message.technologyIds.forEach((id) => deliveredTechnologyIds.add(id));
        } else {
          summary.failedCount += 1;
          addFailure(
            summary.failures,
            getPushServiceHost(target.endpoint),
            result.error ?? "error"
          );

          if (result.expired) {
            expiredIds.add(target.id);
          }
        }
      }
    }
  );

  await Promise.all(workers);

  const now = new Date().toISOString();

  // Re-read inside the update so a subscribe that landed during the sends is
  // kept: only the expired ids and the pushed marks are applied on top.
  updatePushSubscriptionStore((current) => {
    const pruned = removePushSubscriptionsById(current, expiredIds, now);
    const marked = markTechnologiesPushed(pruned, deliveredTechnologyIds, now);

    return { store: marked, result: undefined };
  });

  summary.expiredRemovedCount = expiredIds.size;
  summary.pushedSignalCount = deliveredTechnologyIds.size;

  tryRecordWorkflowEvent({
    entityType: "push_run",
    entityId: `push-${date}`,
    action:
      summary.plannedCount > 0 && summary.sentCount === 0
        ? "push.failed"
        : "push.sent",
    actorType: "workspace_user",
    // Counts only: no endpoint, key or subscription id enters the audit log.
    metadata: { ...summary }
  });

  return summary;
}
