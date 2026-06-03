import { buildDailyDigestWebhookPayload } from "@/lib/delivery/digest-payload";
import type { DailyDigestWebhookTechnology } from "@/lib/delivery/digest-payload";

import { postAdapterPayload } from "./shared";
import type { DeliveryAdapter } from "./types";

function formatDigestItem(
  item: DailyDigestWebhookTechnology,
  index: number
): string {
  const reason = item.reason || item.summary;

  return `${index + 1}. ${item.title}\n   ${reason}\n   来源：${item.sourceName} · ${item.publishDate}`;
}

export function buildFeishuDigestText(
  digest: Parameters<DeliveryAdapter["buildPayload"]>[0],
  deliveredAt: string
): string {
  const payload = buildDailyDigestWebhookPayload(digest, deliveredAt);
  const highPriorityItems = payload.highPriorityItems.slice(0, 3);
  const watchItems = payload.watchItems.slice(0, 3);
  const lines = [
    payload.title,
    `日期：${payload.digestDate}`,
    "",
    payload.summary,
    "",
    "今日立即关注：",
    ...(highPriorityItems.length > 0
      ? highPriorityItems.map(formatDigestItem)
      : ["暂无立即关注内容。"]),
    "",
    "值得跟踪：",
    ...(watchItems.length > 0
      ? watchItems.map(formatDigestItem)
      : ["暂无值得跟踪内容。"]),
    "",
    `阅读全文：${payload.digestUrl}`
  ];

  return lines.join("\n");
}

export const feishuWebhookAdapter: DeliveryAdapter = {
  type: "feishu_webhook",
  label: "Feishu bot webhook",
  buildPayload(digest, _channel, deliveredAt) {
    const text = buildFeishuDigestText(digest, deliveredAt);
    const body = JSON.stringify(
      {
        msg_type: "text",
        content: {
          text
        }
      },
      null,
      2
    );

    return {
      body,
      contentType: "application/json; charset=utf-8",
      preview: text
    };
  },
  send(channel, payload) {
    return postAdapterPayload(channel, payload);
  },
  validateChannelConfig(config) {
    return config.format === "text"
      ? []
      : ["Feishu webhook currently supports text format only."];
  }
};
