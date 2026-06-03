import type { DeliveryChannel } from "@/types/content";

import type {
  DeliveryAdapterPayload,
  DeliveryAdapterSendResult
} from "./types";

export async function postAdapterPayload(
  channel: DeliveryChannel,
  payload: DeliveryAdapterPayload
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

  const response = await fetch(channel.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": payload.contentType
    },
    body: payload.body
  });

  return {
    ok: response.ok,
    status: response.status,
    bodyPreview: await response.text()
  };
}
