import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// workflow-events.ts fixes its file path when it is first imported, so a temp
// LOCAL_DATA_DIR set in beforeEach would not reach it; capture the calls.
const recordedEvents = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/workflow-events", () => ({
  tryRecordWorkflowEvent: (input: unknown) => {
    recordedEvents.push(input);
    return undefined;
  }
}));

import {
  decodeBase64Url,
  decryptWebPushPayload,
  encodeBase64Url,
  generateVapidKeyPair
} from "@/lib/push-crypto";
import {
  buildPushNotificationPayload,
  planPushMessages,
  runPushForDate,
  type PushSignal
} from "@/lib/push-dispatch";
import { sendWebPush } from "@/lib/push-send";
import {
  createEmptyPushSubscriptionStore,
  getPushSubscriptionId,
  readPushSubscriptionStore,
  writePushSubscriptionStore,
  type PushSubscriptionRecord
} from "@/lib/push-subscriptions";

const date = "2026-10-13";

const signals: PushSignal[] = [
  {
    id: "t-agent",
    slug: "agent-sdk",
    title: "智能体 SDK 发布",
    publishDate: date,
    tags: ["agents"]
  },
  {
    id: "t-infer",
    slug: "fast-infer",
    title: "推理加速",
    publishDate: date,
    tags: ["inference"]
  },
  {
    id: "t-both",
    slug: "agent-infer",
    title: "智能体推理",
    publishDate: date,
    tags: ["agents", "inference"]
  },
  {
    id: "t-old",
    slug: "old",
    title: "旧信号",
    publishDate: "2026-10-12",
    tags: ["agents"]
  }
];

function record(name: string, topicIds: string[]): PushSubscriptionRecord {
  const endpoint = `https://fcm.googleapis.com/fcm/send/${name}`;

  return {
    id: getPushSubscriptionId(endpoint),
    endpoint,
    keys: {
      p256dh: generateVapidKeyPair().publicKey,
      auth: encodeBase64Url(Buffer.alloc(16, 1))
    },
    topicIds,
    createdAt: "2026-10-01T00:00:00.000Z"
  };
}

describe("planPushMessages", () => {
  it("sends each subscriber one message for that day's matching signals", () => {
    const agentsOnly = record("a", ["agents"]);
    const inferenceOnly = record("b", ["inference"]);
    const unrelated = record("c", ["open-weights"]);
    const plan = planPushMessages({
      subscriptions: [agentsOnly, inferenceOnly, unrelated],
      signals,
      date,
      pushedTechnologyIds: ["t-infer"]
    });

    expect(plan.candidateIds).toEqual(["t-agent", "t-both"]);
    expect(plan.alreadyPushedIds).toEqual(["t-infer"]);
    expect(plan.messages).toEqual([
      {
        subscriptionId: agentsOnly.id,
        technologyIds: ["t-agent", "t-both"],
        payload: {
          title: "AI Tech Radar · 你关注的话题有 2 条新信号",
          body: "「智能体 SDK 发布」等 2 条",
          url: "/technologies?view=followed",
          tag: `signals-${date}`
        }
      },
      {
        subscriptionId: inferenceOnly.id,
        technologyIds: ["t-both"],
        payload: {
          title: "AI Tech Radar · 你关注的话题有新信号",
          body: "智能体推理",
          url: "/technologies/agent-infer",
          tag: `signals-${date}`
        }
      }
    ]);
  });

  it("puts no endpoint or key into a payload", () => {
    const subscriber = record("secret-endpoint", ["agents"]);
    const plan = planPushMessages({
      subscriptions: [subscriber],
      signals,
      date,
      pushedTechnologyIds: []
    });
    const text = JSON.stringify(
      plan.messages.map((message) => message.payload)
    );

    expect(text).not.toContain("secret-endpoint");
    expect(text).not.toContain(subscriber.keys.auth);
  });

  it("clips a long title in the notification body", () => {
    const payload = buildPushNotificationPayload(
      [{ ...signals[0], title: "长".repeat(80) }],
      date
    );

    expect(payload.body).toHaveLength(60);
    expect(payload.body.endsWith("…")).toBe(true);
  });
});

describe("runPushForDate", () => {
  let dataDir: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "push-dispatch-"));

    for (const key of ["LOCAL_DATA_DIR", "PERSISTENCE_DRIVER"]) {
      saved[key] = process.env[key];
    }

    process.env.LOCAL_DATA_DIR = dataDir;
    process.env.PERSISTENCE_DRIVER = "json";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("sends, deletes 404/410 subscriptions, marks signals and never re-sends", async () => {
    const live = record("live", ["agents"]);
    const gone = record("gone", ["agents"]);
    const flaky = record("flaky", ["inference"]);

    writePushSubscriptionStore({
      ...createEmptyPushSubscriptionStore(),
      subscriptions: [live, gone, flaky]
    });

    const sent: string[] = [];
    const vapid = {
      keys: generateVapidKeyPair(),
      subject: "https://aizyradar.cn"
    };
    const send = async (target: PushSubscriptionRecord) => {
      sent.push(target.id);

      if (target.id === gone.id)
        return { ok: false, status: 410, expired: true, error: "HTTP 410" };
      if (target.id === flaky.id)
        return { ok: false, status: 500, expired: false, error: "HTTP 500" };
      return { ok: true, status: 201, expired: false };
    };

    const preview = await runPushForDate(date, { dryRun: true, signals });
    expect(preview).toMatchObject({
      dryRun: true,
      subscriberCount: 3,
      candidateSignalCount: 3,
      plannedCount: 3,
      sentCount: 0
    });
    expect(sent).toEqual([]);

    const summary = await runPushForDate(date, { signals, vapid, send });

    expect(summary).toMatchObject({
      sentCount: 1,
      failedCount: 2,
      expiredRemovedCount: 1,
      pushedSignalCount: 2 // t-agent and t-both reached `live`; t-infer reached no one
    });
    // Sends run concurrently, so the order is not fixed.
    expect(summary.failures).toHaveLength(2);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        { service: "fcm.googleapis.com", reason: "HTTP 410", count: 1 },
        { service: "fcm.googleapis.com", reason: "HTTP 500", count: 1 }
      ])
    );

    const store = readPushSubscriptionStore();
    expect(store.subscriptions.map((r) => r.id).sort()).toEqual(
      [live.id, flaky.id].sort()
    );
    expect(store.pushedTechnologyIds).toEqual(["t-agent", "t-both"]);

    // Second press: only t-infer is still unpushed, and only `flaky` follows it.
    sent.length = 0;
    const again = await runPushForDate(date, { signals, vapid, send });
    expect(again).toMatchObject({
      candidateSignalCount: 1,
      alreadyPushedSignalCount: 2,
      plannedCount: 1
    });
    expect(sent).toEqual([flaky.id]);

    // The audit log holds counts, never an address.
    const events = JSON.stringify(recordedEvents);
    expect(recordedEvents).toHaveLength(2);
    expect(events).toContain("push.sent");
    for (const secret of [
      live.endpoint,
      gone.endpoint,
      live.keys.auth,
      live.id
    ]) {
      expect(events).not.toContain(secret);
    }
  });

  it("refuses to send without VAPID keys", async () => {
    writePushSubscriptionStore({
      ...createEmptyPushSubscriptionStore(),
      subscriptions: [record("x", ["agents"])]
    });

    await expect(
      runPushForDate(date, { signals, vapid: null })
    ).rejects.toThrow(/推送未配置/);
  });
});

describe("sendWebPush", () => {
  it("POSTs an RFC 8291 body with VAPID and TTL headers that the receiver can decrypt", async () => {
    // A receiving browser: its own key pair and auth secret.
    const receiver = generateVapidKeyPair();
    const authSecret = Buffer.alloc(16, 3);
    const vapid = {
      keys: generateVapidKeyPair(),
      subject: "https://aizyradar.cn"
    };
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;

    const result = await sendWebPush(
      {
        endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc",
        keys: { p256dh: receiver.publicKey, auth: encodeBase64Url(authSecret) }
      },
      JSON.stringify({ title: "测试", body: "一条", url: "/" }),
      vapid,
      { fetchImpl, ttlSeconds: 600 }
    );

    expect(result).toEqual({
      status: 201,
      ok: true,
      expired: false,
      error: undefined
    });

    const headers = captured?.init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("600");
    expect(headers.Authorization).toMatch(
      new RegExp(`^vapid t=.+, k=${vapid.keys.publicKey}$`)
    );

    const body = Buffer.from(captured?.init.body as Uint8Array);
    const plaintext = decryptWebPushPayload(
      body,
      decodeBase64Url(receiver.privateKey),
      authSecret
    );
    expect(JSON.parse(plaintext.toString("utf8"))).toEqual({
      title: "测试",
      body: "一条",
      url: "/"
    });
  });

  it("reports 404 and 410 as expired, network failures as not sent", async () => {
    const keys = {
      p256dh: generateVapidKeyPair().publicKey,
      auth: encodeBase64Url(Buffer.alloc(16))
    };
    const vapid = {
      keys: generateVapidKeyPair(),
      subject: "https://aizyradar.cn"
    };
    const respond = (status: number) =>
      (async () => new Response(null, { status })) as unknown as typeof fetch;
    const target = { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys };

    expect(
      (await sendWebPush(target, "{}", vapid, { fetchImpl: respond(410) }))
        .expired
    ).toBe(true);
    expect(
      (await sendWebPush(target, "{}", vapid, { fetchImpl: respond(404) }))
        .expired
    ).toBe(true);
    expect(
      (await sendWebPush(target, "{}", vapid, { fetchImpl: respond(429) }))
        .expired
    ).toBe(false);

    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(
      await sendWebPush(target, "{}", vapid, { fetchImpl: failing })
    ).toEqual({
      status: null,
      ok: false,
      expired: false,
      error: "TypeError"
    });
  });
});
