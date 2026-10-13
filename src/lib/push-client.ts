// Browser side of 「有新信号时提醒我」. Client-only (every function checks for
// the APIs it uses), shared by the toggle in 我关注的 and the follow-change
// sync in PwaRegistration.
//
// The browser's PushSubscription is the source of truth for "is this reader
// subscribed"; the server record mirrors it with the followed topics. Every
// follow change anywhere on the site re-sends the topics, and an empty topic
// list deletes the server record (the browser subscription stays, so
// following a topic again recreates it without asking for permission again).

import { readFollowedTagIds } from "@/lib/followed-tags";

export interface PushClientConfig {
  enabled: boolean;
  publicKey?: string;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function decodeApplicationServerKey(
  base64Url: string
): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

let configPromise: Promise<PushClientConfig> | undefined;

export function fetchPushConfig(): Promise<PushClientConfig> {
  configPromise ??= fetch("/api/push/config", { cache: "no-store" })
    .then((response) =>
      response.ok
        ? (response.json() as Promise<PushClientConfig>)
        : { enabled: false }
    )
    .catch(() => ({ enabled: false }));

  return configPromise;
}

async function getRegistration(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (!isPushSupported()) {
    return undefined;
  }

  return (await navigator.serviceWorker.getRegistration("/")) ?? undefined;
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration();

  return registration ? registration.pushManager.getSubscription() : null;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Sends the current follows for an existing subscription; no-op without one. */
export async function syncPushTopics(
  topicIds: string[] = readFollowedTagIds()
): Promise<void> {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    return;
  }

  await postJson("/api/push/subscribe", {
    subscription: subscription.toJSON(),
    topicIds
  });
}

export type EnablePushResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "disabled" | "denied" | "error";
      message: string;
    };

export async function enablePush(
  topicIds: string[]
): Promise<EnablePushResult> {
  const config = await fetchPushConfig();
  const registration = await getRegistration();

  if (!registration) {
    return {
      ok: false,
      reason: "unsupported",
      message: "这个浏览器不支持网页提醒。"
    };
  }

  if (!config.enabled || !config.publicKey) {
    return {
      ok: false,
      reason: "disabled",
      message: "本站暂未开启新信号提醒。"
    };
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return {
      ok: false,
      reason: "denied",
      message: "浏览器没有允许通知。可以在地址栏左侧的网站设置里改回「允许」。"
    };
  }

  let subscription: PushSubscription;

  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(config.publicKey)
      }));
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "浏览器的推送服务没有响应，稍后再试。"
    };
  }

  const response = await postJson("/api/push/subscribe", {
    subscription: subscription.toJSON(),
    topicIds
  }).catch(() => undefined);

  if (!response?.ok) {
    // Leave nothing half-done: no server record, so no browser subscription.
    await subscription.unsubscribe().catch(() => undefined);

    return {
      ok: false,
      reason: "error",
      message: response
        ? await readError(response, "开启失败，稍后再试。")
        : "开启失败，稍后再试。"
    };
  }

  return { ok: true };
}

/** Deletes the server record first, then the browser subscription. */
export async function disablePush(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    return { ok: true };
  }

  const response = await postJson("/api/push/unsubscribe", {
    subscription: subscription.toJSON()
  }).catch(() => undefined);

  if (!response?.ok) {
    return { ok: false, message: "关闭失败，稍后再试。" };
  }

  await subscription.unsubscribe().catch(() => undefined);

  return { ok: true };
}
