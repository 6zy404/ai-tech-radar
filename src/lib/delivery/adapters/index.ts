import type { DeliveryChannelType } from "@/types/content";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";

import { discordAdapter } from "./discord";
import { feishuWebhookAdapter } from "./feishu";
import { telegramAdapter } from "./telegram";
import type { DeliveryAdapter } from "./types";
import { webhookAdapter } from "./webhook";

const activeAdapters = {
  webhook: webhookAdapter,
  feishu_webhook: feishuWebhookAdapter,
  telegram: telegramAdapter,
  discord: discordAdapter
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
  return ["email"];
}

export { getDeliveryChannelTypeLabel };

export type {
  DeliveryAdapterPayload,
  DeliveryAdapterSendResult
} from "./types";
