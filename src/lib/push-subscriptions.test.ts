import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { encodeBase64Url, generateVapidKeyPair } from "@/lib/push-crypto";
import {
  createEmptyPushSubscriptionStore,
  getPushSubscriptionId,
  isAllowedPushEndpoint,
  markTechnologiesPushed,
  parsePushSubscriptionInput,
  parsePushUnsubscribeInput,
  pushSubscriptionsFileName,
  readPushSubscriptionStore,
  removePushSubscription,
  removePushSubscriptionsById,
  summarizePushSubscriptions,
  toPublicPushSubscriptionResult,
  updatePushSubscriptionStore,
  upsertPushSubscription,
  type PushSubscriptionInput
} from "@/lib/push-subscriptions";

const knownTopics = new Set(["agents", "inference", "open-weights"]);
const now = "2026-10-13T08:00:00.000Z";

function browserSubscription(
  endpoint = "https://fcm.googleapis.com/fcm/send/abc:123"
) {
  return {
    endpoint,
    expirationTime: null,
    keys: {
      // Any valid uncompressed P-256 point will do; a VAPID public key is one.
      p256dh: generateVapidKeyPair().publicKey,
      auth: encodeBase64Url(Buffer.alloc(16, 7))
    }
  };
}

function input(
  topicIds: string[],
  subscription = browserSubscription()
): PushSubscriptionInput {
  const parsed = parsePushSubscriptionInput(
    { subscription, topicIds },
    knownTopics
  );

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  return parsed.value;
}

describe("isAllowedPushEndpoint", () => {
  it("accepts the browser push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx",
      "https://wns2-sg2p.notify.windows.com/w/?token=abc"
    ]) {
      expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    }
  });

  it("refuses anything the server should not POST to", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc", // not https
      "https://127.0.0.1:3000/api/workspace/push",
      "https://localhost/x",
      "https://fcm.googleapis.com.evil.example/x", // suffix trick
      "https://evilfcm.googleapis.com.example/x",
      "https://notfcm.googleapis.co/x",
      "https://fcm.googleapis.com:8443/x", // explicit port
      "https://user@fcm.googleapis.com/x",
      `https://fcm.googleapis.com/${"a".repeat(1100)}`,
      "not a url"
    ]) {
      expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    }
  });
});

describe("parsePushSubscriptionInput", () => {
  it("keeps endpoint, keys and known topics only, sorted and deduplicated", () => {
    const subscription = browserSubscription();
    const parsed = parsePushSubscriptionInput(
      {
        subscription,
        topicIds: ["open-weights", "agents", "agents", "retired-topic", 42]
      },
      knownTopics
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        topicIds: ["agents", "open-weights"]
      }
    });
  });

  it("refuses malformed keys and foreign endpoints", () => {
    const good = browserSubscription();

    for (const subscription of [
      { ...good, keys: { ...good.keys, p256dh: "AAAA" } },
      {
        ...good,
        keys: { ...good.keys, auth: encodeBase64Url(Buffer.alloc(15)) }
      },
      {
        ...good,
        keys: {
          p256dh: encodeBase64Url(Buffer.alloc(65, 5)),
          auth: good.keys.auth
        }
      }, // not 0x04-prefixed
      { ...good, endpoint: "https://example.com/push" },
      { endpoint: good.endpoint }
    ]) {
      expect(
        parsePushSubscriptionInput({ subscription, topicIds: [] }, knownTopics)
          .ok
      ).toBe(false);
    }

    expect(parsePushSubscriptionInput(null, knownTopics).ok).toBe(false);
    expect(
      parsePushSubscriptionInput(
        {
          subscription: good,
          topicIds: Array.from({ length: 65 }, () => "agents")
        },
        knownTopics
      ).ok
    ).toBe(false);
  });

  it("reads unsubscribe input as endpoint plus auth", () => {
    const subscription = browserSubscription();

    expect(parsePushUnsubscribeInput({ subscription })).toEqual({
      ok: true,
      value: { endpoint: subscription.endpoint, auth: subscription.keys.auth }
    });
    expect(
      parsePushUnsubscribeInput({
        subscription: { endpoint: subscription.endpoint }
      }).ok
    ).toBe(false);
  });
});

describe("upsert / remove", () => {
  it("creates a record holding only endpoint, keys, topics and createdAt", () => {
    const value = input(["agents"]);
    const { store, outcome } = upsertPushSubscription(
      createEmptyPushSubscriptionStore(),
      value,
      now
    );

    expect(outcome).toBe("created");
    expect(store.subscriptions).toEqual([
      {
        id: getPushSubscriptionId(value.endpoint),
        endpoint: value.endpoint,
        keys: value.keys,
        topicIds: ["agents"],
        createdAt: now
      }
    ]);
  });

  it("updates topics in place, keeps createdAt, and reports no-op changes", () => {
    const value = input(["agents"]);
    const created = upsertPushSubscription(
      createEmptyPushSubscriptionStore(),
      value,
      now
    ).store;
    const later = "2026-10-14T00:00:00.000Z";
    const updated = upsertPushSubscription(
      created,
      { ...value, topicIds: ["agents", "inference"] },
      later
    );

    expect(updated.outcome).toBe("updated");
    expect(updated.store.subscriptions[0]).toMatchObject({
      topicIds: ["agents", "inference"],
      createdAt: now
    });
    expect(
      upsertPushSubscription(
        updated.store,
        { ...value, topicIds: ["agents", "inference"] },
        later
      )
    ).toEqual({
      store: updated.store,
      outcome: "unchanged"
    });
  });

  it("deletes the record when the topic list empties", () => {
    const value = input(["agents"]);
    const created = upsertPushSubscription(
      createEmptyPushSubscriptionStore(),
      value,
      now
    ).store;
    const emptied = upsertPushSubscription(
      created,
      { ...value, topicIds: [] },
      now
    );

    expect(emptied.outcome).toBe("removed");
    expect(emptied.store.subscriptions).toEqual([]);
    expect(
      upsertPushSubscription(emptied.store, { ...value, topicIds: [] }, now)
        .outcome
    ).toBe("not-subscribed");
  });

  it("will not let a caller without the auth secret change or delete a record", () => {
    const value = input(["agents"]);
    const created = upsertPushSubscription(
      createEmptyPushSubscriptionStore(),
      value,
      now
    ).store;
    const forged = {
      ...value,
      keys: { ...value.keys, auth: encodeBase64Url(Buffer.alloc(16, 9)) }
    };

    expect(
      upsertPushSubscription(
        created,
        { ...forged, topicIds: ["inference"] },
        now
      ).outcome
    ).toBe("conflict");
    expect(
      removePushSubscription(created, value.endpoint, forged.keys.auth, now)
        .removed
    ).toBe(false);

    const removed = removePushSubscription(
      created,
      value.endpoint,
      value.keys.auth,
      now
    );
    expect(removed.removed).toBe(true);
    expect(removed.store.subscriptions).toEqual([]);
  });

  it("removes by id and marks pushed signals once", () => {
    const a = input(
      ["agents"],
      browserSubscription("https://fcm.googleapis.com/fcm/send/a")
    );
    const b = input(
      ["agents"],
      browserSubscription("https://fcm.googleapis.com/fcm/send/b")
    );
    let store = upsertPushSubscription(
      createEmptyPushSubscriptionStore(),
      a,
      now
    ).store;
    store = upsertPushSubscription(store, b, now).store;

    const pruned = removePushSubscriptionsById(
      store,
      new Set([getPushSubscriptionId(a.endpoint)]),
      now
    );
    expect(pruned.subscriptions.map((record) => record.endpoint)).toEqual([
      b.endpoint
    ]);

    const marked = markTechnologiesPushed(pruned, ["t2", "t1"], now);
    expect(marked.pushedTechnologyIds).toEqual(["t1", "t2"]);
    expect(markTechnologiesPushed(marked, ["t1"], now)).toBe(marked);
  });
});

describe("what leaves the store", () => {
  it("the public subscribe answer carries no stored field", () => {
    const value = input(["agents", "inference"]);
    const result = toPublicPushSubscriptionResult("created", value);
    const text = JSON.stringify(result);

    expect(result).toEqual({ subscribed: true, topicCount: 2 });
    expect(text).not.toContain(value.endpoint);
    expect(text).not.toContain(value.keys.auth);
    expect(text).not.toContain(value.keys.p256dh);
    expect(toPublicPushSubscriptionResult("removed", value)).toEqual({
      subscribed: false,
      topicCount: 0
    });
  });

  it("the workspace summary is counts only", () => {
    const a = input(
      ["agents", "inference"],
      browserSubscription("https://fcm.googleapis.com/fcm/send/a")
    );
    const b = input(
      ["agents"],
      browserSubscription(
        "https://updates.push.services.mozilla.com/wpush/v2/b"
      )
    );
    let store = upsertPushSubscription(
      createEmptyPushSubscriptionStore(),
      a,
      now
    ).store;
    store = upsertPushSubscription(store, b, now).store;
    store = markTechnologiesPushed(store, ["t1"], now);

    const summary = summarizePushSubscriptions(store);
    const text = JSON.stringify(summary);

    expect(summary).toEqual({
      total: 2,
      byTopic: [
        { topicId: "agents", count: 2 },
        { topicId: "inference", count: 1 }
      ],
      pushedSignalCount: 1
    });

    for (const secret of [
      a.endpoint,
      b.endpoint,
      a.keys.auth,
      b.keys.p256dh,
      getPushSubscriptionId(a.endpoint)
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("the store file", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;
  let previousDriver: string | undefined;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "push-subscriptions-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    previousDriver = process.env.PERSISTENCE_DRIVER;
    process.env.LOCAL_DATA_DIR = dataDir;
    process.env.PERSISTENCE_DRIVER = "json";
  });

  afterEach(() => {
    process.env.LOCAL_DATA_DIR = previousDataDir;
    process.env.PERSISTENCE_DRIVER = previousDriver;

    if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
    if (previousDriver === undefined) delete process.env.PERSISTENCE_DRIVER;

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads as empty when absent, and writes only on a real change", () => {
    expect(readPushSubscriptionStore()).toEqual(
      createEmptyPushSubscriptionStore()
    );

    const value = input(["agents"]);
    const outcome = updatePushSubscriptionStore((store) => {
      const next = upsertPushSubscription(store, value, now);
      return { store: next.store, result: next.outcome };
    });

    expect(outcome).toBe("created");

    const written = JSON.parse(
      readFileSync(path.join(dataDir, pushSubscriptionsFileName), "utf8")
    );
    expect(written.subscriptions).toHaveLength(1);
    // The record's keys are exactly the promised fields.
    expect(Object.keys(written.subscriptions[0]).sort()).toEqual([
      "createdAt",
      "endpoint",
      "id",
      "keys",
      "topicIds"
    ]);
    expect(readPushSubscriptionStore().subscriptions[0].endpoint).toBe(
      value.endpoint
    );

    const removed = updatePushSubscriptionStore((store) => {
      const next = removePushSubscription(
        store,
        value.endpoint,
        value.keys.auth,
        now
      );
      return { store: next.store, result: next.removed };
    });

    expect(removed).toBe(true);
    expect(readPushSubscriptionStore().subscriptions).toEqual([]);
  });
});
