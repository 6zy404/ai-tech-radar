import type { DeliveryChannelType } from "@/types/content";

export function getDeliveryChannelTypeLabel(type: DeliveryChannelType): string {
  switch (type) {
    case "webhook":
      return "通用 Webhook";
    case "feishu_webhook":
      return "飞书机器人 Webhook";
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    case "email":
      return "邮件";
    default:
      return type;
  }
}
