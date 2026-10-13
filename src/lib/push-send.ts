// One Web Push request (RFC 8030) — encrypt, sign, POST. Server-side only.

import {
  buildVapidAuthorization,
  encryptWebPushPayload
} from "@/lib/push-crypto";
import type { PushVapidConfig } from "@/lib/push-config";

export interface WebPushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushResult {
  /** HTTP status from the push service, or null when the request failed. */
  status: number | null;
  /** True when the subscription is gone (404 / 410) and should be deleted. */
  expired: boolean;
  ok: boolean;
  /** A short, endpoint-free reason for the log. */
  error?: string;
}

export interface SendWebPushOptions {
  /** Seconds the push service may hold the message for an offline browser. */
  ttlSeconds?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}

export async function sendWebPush(
  target: WebPushTarget,
  payload: string,
  vapid: PushVapidConfig,
  options: SendWebPushOptions = {}
): Promise<WebPushResult> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const body = encryptWebPushPayload(payload, target.keys);
    const response = await fetchImpl(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: buildVapidAuthorization(
          target.endpoint,
          vapid.keys,
          vapid.subject,
          options.nowMs
        ),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(options.ttlSeconds ?? 86_400),
        Urgency: "normal"
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      redirect: "error"
    });
    const status = response.status;

    // The body is the push service's error text at most; read it so the
    // connection is released, but never store it — it can echo the endpoint.
    await response.arrayBuffer().catch(() => undefined);

    return {
      status,
      ok: status >= 200 && status < 300,
      expired: status === 404 || status === 410,
      error: status >= 200 && status < 300 ? undefined : `HTTP ${status}`
    };
  } catch (error) {
    // `fetch failed` hides the reason in `cause`; the code (a connect timeout,
    // a refused connection) is what tells an editor the proxy is missing.
    const code =
      error instanceof Error
        ? (error.cause as { code?: unknown } | undefined)?.code
        : undefined;

    return {
      status: null,
      ok: false,
      expired: false,
      error:
        error instanceof Error
          ? typeof code === "string"
            ? `${error.name} (${code})`
            : error.name
          : "error"
    };
  }
}
