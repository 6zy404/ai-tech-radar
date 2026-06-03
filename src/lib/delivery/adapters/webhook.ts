import { buildDigestShareText } from "@/lib/digest-delivery";
import { buildDailyDigestWebhookPayload } from "@/lib/delivery/digest-payload";

import { postAdapterPayload } from "./shared";
import type { DeliveryAdapter } from "./types";

export const webhookAdapter: DeliveryAdapter = {
  type: "webhook",
  label: "Generic webhook",
  buildPayload(digest, channel, deliveredAt) {
    const body =
      channel.format === "text"
        ? buildDigestShareText(digest)
        : JSON.stringify(
            buildDailyDigestWebhookPayload(digest, deliveredAt),
            null,
            2
          );

    return {
      body,
      contentType:
        channel.format === "text"
          ? "text/plain; charset=utf-8"
          : "application/json; charset=utf-8"
    };
  },
  send(channel, payload) {
    return postAdapterPayload(channel, payload);
  },
  validateChannelConfig() {
    return [];
  }
};
