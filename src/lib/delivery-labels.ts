import type { DeliveryChannelType } from "@/types/content";

export function getDeliveryChannelTypeLabel(type: DeliveryChannelType): string {
  switch (type) {
    case "webhook":
      return "Generic webhook";
    case "feishu_webhook":
      return "Feishu bot webhook";
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    case "email":
      return "Email";
    default:
      return type;
  }
}
