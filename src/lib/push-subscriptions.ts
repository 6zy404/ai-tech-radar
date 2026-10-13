// Reader push subscriptions — the one piece of per-reader state this site
// keeps on the server, and only for a reader who turned 「有新信号时提醒我」 on.
//
// What a record holds is exactly what /about promises: the push address the
// browser's push service issued, its two keys, the followed topic ids, and
// when it was created. No IP, no user agent, no reading history; the record
// id is a hash of the endpoint, not a new identifier. The store also keeps
// which signals have already been pushed, so the same signal never goes out
// twice.
//
// Stored as `config/push-subscriptions.json` (git-ignored: the endpoints are
// bearer addresses) and, under the SQLite driver, as one `runtime_configs`
// row like the other single-object stores. Never read by a public page; the
// only public routes that touch it write to it (/api/push/subscribe,
// /api/push/unsubscribe) and answer with no stored field.

import { createHash } from "node:crypto";

import {
  decodeBase64Url,
  isUncompressedP256PublicKey
} from "@/lib/push-crypto";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";

export const pushSubscriptionsFileName = "push-subscriptions.json";

export interface PushSubscriptionRecord {
  /** sha256 of the endpoint, truncated — derived, so it adds nothing. */
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  topicIds: string[];
  createdAt: string;
}

export interface PushSubscriptionStore {
  updatedAt: string;
  subscriptions: PushSubscriptionRecord[];
  /** Signals already sent in a push; never sent again. */
  pushedTechnologyIds: string[];
}

export function createEmptyPushSubscriptionStore(): PushSubscriptionStore {
  return {
    updatedAt: new Date(0).toISOString(),
    subscriptions: [],
    pushedTechnologyIds: []
  };
}

/**
 * Push services this server will POST to. The endpoint comes from the
 * reader's browser, so without this list a forged subscription could make the
 * server send requests to any address it can reach — including itself on
 * 127.0.0.1. Hosts match exactly or as a subdomain.
 */
export const allowedPushServiceHosts = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Opera, Android
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "push.services.mozilla.com",
  "notify.windows.com", // legacy Edge / WNS (wns2-*.notify.windows.com)
  "push.apple.com" // Safari 16+ (web.push.apple.com)
];

export const maxPushSubscriptions = 10_000;
const maxEndpointLength = 1024;
const maxTopicIds = 64;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > maxEndpointLength) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.port !== "" || url.username) {
    return false;
  }

  const host = url.hostname.toLowerCase();

  return allowedPushServiceHosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export function getPushSubscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  topicIds: string[];
}

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBase64UrlOfLength(value: unknown, length: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+=*$/.test(value)) {
    return false;
  }

  return decodeBase64Url(value).length === length;
}

export const invalidSubscriptionMessage = "提醒订阅格式不正确。";

/**
 * Reads the `PushSubscription.toJSON()` shape the browser produces plus the
 * followed topic ids. Unknown topic ids are dropped rather than refused: a
 * topic can be retired between a reader's visits.
 */
export function parsePushSubscriptionInput(
  body: unknown,
  knownTopicIds: ReadonlySet<string>
): ParseResult<PushSubscriptionInput> {
  if (!isRecord(body) || !isRecord(body.subscription)) {
    return { ok: false, error: invalidSubscriptionMessage };
  }

  const { endpoint, keys } = body.subscription;

  if (typeof endpoint !== "string" || !isAllowedPushEndpoint(endpoint)) {
    return { ok: false, error: "不支持这个推送服务地址。" };
  }

  if (
    !isRecord(keys) ||
    !isBase64UrlOfLength(keys.p256dh, 65) ||
    !isUncompressedP256PublicKey(decodeBase64Url(keys.p256dh)) ||
    !isBase64UrlOfLength(keys.auth, 16)
  ) {
    return { ok: false, error: invalidSubscriptionMessage };
  }

  const rawTopicIds = Array.isArray(body.topicIds) ? body.topicIds : [];

  if (rawTopicIds.length > maxTopicIds) {
    return { ok: false, error: invalidSubscriptionMessage };
  }

  const topicIds = Array.from(
    new Set(
      rawTopicIds.filter(
        (id): id is string => typeof id === "string" && knownTopicIds.has(id)
      )
    )
  ).sort();

  return {
    ok: true,
    value: {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      topicIds
    }
  };
}

/** For unsubscribe: the endpoint and the auth secret that proves the caller holds it. */
export function parsePushUnsubscribeInput(
  body: unknown
): ParseResult<{ endpoint: string; auth: string }> {
  if (!isRecord(body) || !isRecord(body.subscription)) {
    return { ok: false, error: invalidSubscriptionMessage };
  }

  const { endpoint, keys } = body.subscription;

  if (
    typeof endpoint !== "string" ||
    !isAllowedPushEndpoint(endpoint) ||
    !isRecord(keys) ||
    !isBase64UrlOfLength(keys.auth, 16)
  ) {
    return { ok: false, error: invalidSubscriptionMessage };
  }

  return { ok: true, value: { endpoint, auth: keys.auth } };
}

export type UpsertOutcome =
  | "created"
  | "updated"
  | "removed"
  | "unchanged"
  | "not-subscribed"
  | "conflict"
  | "full";

/**
 * Pure core of a subscribe call. An empty topic list removes the record —
 * a subscription that matches nothing should not sit on the server — and
 * the next call with topics recreates it. An existing endpoint only changes
 * when the caller also presents its auth secret, so knowing an endpoint is
 * not enough to rewrite someone's topics.
 */
export function upsertPushSubscription(
  store: PushSubscriptionStore,
  input: PushSubscriptionInput,
  now: string
): { store: PushSubscriptionStore; outcome: UpsertOutcome } {
  const existing = store.subscriptions.find(
    (record) => record.endpoint === input.endpoint
  );

  if (existing && existing.keys.auth !== input.keys.auth) {
    return { store, outcome: "conflict" };
  }

  if (input.topicIds.length === 0) {
    if (!existing) {
      return { store, outcome: "not-subscribed" };
    }

    return {
      store: {
        ...store,
        updatedAt: now,
        subscriptions: store.subscriptions.filter((r) => r !== existing)
      },
      outcome: "removed"
    };
  }

  if (existing) {
    const sameTopics =
      existing.topicIds.length === input.topicIds.length &&
      existing.topicIds.every((id, index) => id === input.topicIds[index]);

    if (sameTopics && existing.keys.p256dh === input.keys.p256dh) {
      return { store, outcome: "unchanged" };
    }

    return {
      store: {
        ...store,
        updatedAt: now,
        subscriptions: store.subscriptions.map((record) =>
          record === existing
            ? { ...record, keys: { ...input.keys }, topicIds: input.topicIds }
            : record
        )
      },
      outcome: "updated"
    };
  }

  if (store.subscriptions.length >= maxPushSubscriptions) {
    return { store, outcome: "full" };
  }

  return {
    store: {
      ...store,
      updatedAt: now,
      subscriptions: [
        ...store.subscriptions,
        {
          id: getPushSubscriptionId(input.endpoint),
          endpoint: input.endpoint,
          keys: { ...input.keys },
          topicIds: input.topicIds,
          createdAt: now
        }
      ]
    },
    outcome: "created"
  };
}

export function removePushSubscription(
  store: PushSubscriptionStore,
  endpoint: string,
  auth: string,
  now: string
): { store: PushSubscriptionStore; removed: boolean } {
  const existing = store.subscriptions.find(
    (record) => record.endpoint === endpoint && record.keys.auth === auth
  );

  if (!existing) {
    return { store, removed: false };
  }

  return {
    store: {
      ...store,
      updatedAt: now,
      subscriptions: store.subscriptions.filter((r) => r !== existing)
    },
    removed: true
  };
}

/** Drops records by id — used when a push service answers 404 or 410. */
export function removePushSubscriptionsById(
  store: PushSubscriptionStore,
  ids: ReadonlySet<string>,
  now: string
): PushSubscriptionStore {
  if (ids.size === 0) {
    return store;
  }

  return {
    ...store,
    updatedAt: now,
    subscriptions: store.subscriptions.filter((record) => !ids.has(record.id))
  };
}

export function markTechnologiesPushed(
  store: PushSubscriptionStore,
  technologyIds: Iterable<string>,
  now: string
): PushSubscriptionStore {
  const next = new Set(store.pushedTechnologyIds);
  const before = next.size;

  for (const id of technologyIds) {
    next.add(id);
  }

  return next.size === before
    ? store
    : { ...store, updatedAt: now, pushedTechnologyIds: [...next].sort() };
}

export interface PublicPushSubscriptionResult {
  subscribed: boolean;
  topicCount: number;
}

/**
 * The whole answer a public subscribe call gets. Picked field by field, so no
 * stored value — endpoint, key, record id, creation time — can ride along.
 */
export function toPublicPushSubscriptionResult(
  outcome: UpsertOutcome,
  input: PushSubscriptionInput
): PublicPushSubscriptionResult {
  const subscribed =
    outcome === "created" || outcome === "updated" || outcome === "unchanged";

  return { subscribed, topicCount: subscribed ? input.topicIds.length : 0 };
}

export interface PushSubscriptionSummary {
  total: number;
  byTopic: Array<{ topicId: string; count: number }>;
  pushedSignalCount: number;
}

/**
 * Counts only — the workspace panel's whole view of the store. It never
 * carries an endpoint, a key or a record id.
 */
export function summarizePushSubscriptions(
  store: PushSubscriptionStore
): PushSubscriptionSummary {
  const counts = new Map<string, number>();

  for (const record of store.subscriptions) {
    for (const topicId of record.topicIds) {
      counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
    }
  }

  return {
    total: store.subscriptions.length,
    byTopic: [...counts.entries()]
      .map(([topicId, count]) => ({ topicId, count }))
      .sort(
        (left, right) =>
          right.count - left.count || left.topicId.localeCompare(right.topicId)
      ),
    pushedSignalCount: store.pushedTechnologyIds.length
  };
}

function normalizeStore(value: unknown): PushSubscriptionStore {
  const empty = createEmptyPushSubscriptionStore();

  if (!isRecord(value)) {
    return empty;
  }

  return {
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : empty.updatedAt,
    subscriptions: Array.isArray(value.subscriptions)
      ? (value.subscriptions as PushSubscriptionRecord[]).filter(
          (record) =>
            isRecord(record) &&
            typeof record.endpoint === "string" &&
            isRecord(record.keys) &&
            Array.isArray(record.topicIds)
        )
      : [],
    pushedTechnologyIds: Array.isArray(value.pushedTechnologyIds)
      ? value.pushedTechnologyIds.filter(
          (id): id is string => typeof id === "string"
        )
      : []
  };
}

export function readPushSubscriptionStore(): PushSubscriptionStore {
  return normalizeStore(
    readLocalJsonFile<unknown>(
      getLocalStoreFilePath(pushSubscriptionsFileName),
      createEmptyPushSubscriptionStore()
    )
  );
}

export function writePushSubscriptionStore(store: PushSubscriptionStore): void {
  writeLocalJsonFile(getLocalStoreFilePath(pushSubscriptionsFileName), store);
}

/**
 * Read-modify-write in one synchronous step, so two requests in this process
 * cannot interleave between the read and the write.
 */
export function updatePushSubscriptionStore<T>(
  change: (store: PushSubscriptionStore) => {
    store: PushSubscriptionStore;
    result: T;
  }
): T {
  const current = readPushSubscriptionStore();
  const { store, result } = change(current);

  if (store !== current) {
    writePushSubscriptionStore(store);
  }

  return result;
}
