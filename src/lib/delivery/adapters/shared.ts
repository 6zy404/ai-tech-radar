import type { DeliveryChannel } from "@/types/content";

import type {
  DeliveryAdapterPayload,
  DeliveryAdapterSendResult
} from "./types";

const sendTimeoutMs = 15_000;

/**
 * POSTs an adapter payload. `url` defaults to the channel's endpoint; the
 * Telegram adapter passes the Bot API method URL it builds from the token,
 * while the mock check still reads the configured endpoint, so a
 * `mock://success` Telegram channel never builds a real request.
 */
export async function postAdapterPayload(
  channel: DeliveryChannel,
  payload: DeliveryAdapterPayload,
  url: string = channel.endpointUrl
): Promise<DeliveryAdapterSendResult> {
  if (channel.endpointUrl.startsWith("mock://success")) {
    return {
      ok: true,
      status: 200,
      bodyPreview: "Mock webhook accepted."
    };
  }

  if (channel.endpointUrl.startsWith("mock://failed")) {
    return {
      ok: false,
      status: 500,
      bodyPreview: "Mock webhook failed."
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": payload.contentType
    },
    body: payload.body,
    signal: AbortSignal.timeout(sendTimeoutMs)
  });

  return {
    ok: response.ok,
    status: response.status,
    bodyPreview: await response.text()
  };
}

export function isMockEndpoint(value: string): boolean {
  return value.startsWith("mock://success") || value.startsWith("mock://failed");
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
