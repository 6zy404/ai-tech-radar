import type { DeliveryChannelType } from "@/types/content";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";

import { discordAdapterPlaceholder } from "./discord";
import { feishuWebhookAdapter } from "./feishu";
import { telegramAdapterPlaceholder } from "./telegram";
import type { DeliveryAdapter } from "./types";
import { webhookAdapter } from "./webhook";

const activeAdapters = {
  webhook: webhookAdapter,
  feishu_webhook: feishuWebhookAdapter
} satisfies Partial<Record<DeliveryChannelType, DeliveryAdapter>>;

export const reservedDeliveryAdapters = {
  telegram: telegramAdapterPlaceholder,
  discord: discordAdapterPlaceholder
} satisfies Partial<Record<DeliveryChannelType, DeliveryAdapter>>;

export function getDeliveryAdapter(
  type: DeliveryChannelType
): DeliveryAdapter | undefined {
  return activeAdapters[type as keyof typeof activeAdapters];
}

export function getSupportedDeliveryChannelTypes(): DeliveryChannelType[] {
  return Object.keys(activeAdapters) as DeliveryChannelType[];
}

export function getReservedDeliveryChannelTypes(): DeliveryChannelType[] {
  return ["telegram", "discord", "email"];
}

export { getDeliveryChannelTypeLabel };

export type { DeliveryAdapterPayload, DeliveryAdapterSendResult } from "./types";
