import type { DailyDigestWebhookTechnology } from "@/lib/delivery/digest-payload";
import type { StoredDeliveryChannel } from "@/types/content";

import {
  buildDigestChatMessage,
  fitBlocks,
  truncatePlainText,
  type DigestChatMessage
} from "./digest-message";
import { isHttpUrl, isMockEndpoint, postAdapterPayload } from "./shared";
import type { DeliveryAdapter } from "./types";

// Telegram Bot API `sendMessage` with `parse_mode: "HTML"`. Only <b> and
// <a href> are used, and every piece of text is escaped first: in that mode
// Telegram rejects the whole message on a stray `<` or `&`.

export const telegramMessageLimit = 4096;
export const defaultTelegramApiBase = "https://api.telegram.org";

const telegramTokenPattern = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;
const telegramChatIdPattern = /^(-?\d+|@[A-Za-z][A-Za-z0-9_]{4,})$/;

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeTelegramAttribute(value: string): string {
  return escapeTelegramHtml(value).replace(/"/g, "&quot;");
}

function formatItem(item: DailyDigestWebhookTechnology, index: number) {
  const title = escapeTelegramHtml(truncatePlainText(item.title, 120));
  const reason = escapeTelegramHtml(
    truncatePlainText(item.reason || item.summary, 160)
  );

  return `${index + 1}. <a href="${escapeTelegramAttribute(item.url)}">${title}</a>\n   ${reason}`;
}

function formatSection(
  heading: string,
  items: DailyDigestWebhookTechnology[],
  emptyText: string
): string[] {
  return [
    `\n<b>${heading}</b>`,
    ...(items.length > 0 ? items.map(formatItem) : [emptyText])
  ];
}

export function buildTelegramDigestHtml(
  message: DigestChatMessage,
  limit = telegramMessageLimit
): string {
  const blocks = [
    `<b>${escapeTelegramHtml(truncatePlainText(message.title, 200))}</b>`,
    `日期：${escapeTelegramHtml(message.date)}`,
    `\n${escapeTelegramHtml(truncatePlainText(message.summary, 800))}`,
    ...formatSection(
      "今日立即关注",
      message.highPriorityItems,
      "暂无立即关注内容。"
    ),
    ...formatSection("值得跟踪", message.watchItems, "暂无值得跟踪内容。")
  ];
  const tail = `\n\n<a href="${escapeTelegramAttribute(message.digestUrl)}">阅读全文</a> ${escapeTelegramHtml(message.digestUrl)}`;

  return fitBlocks(blocks, tail, limit);
}

export function getTelegramApiBase(channel: StoredDeliveryChannel): string {
  return (channel.endpointUrl.trim() || defaultTelegramApiBase).replace(
    /\/+$/,
    ""
  );
}

export const telegramAdapter: DeliveryAdapter = {
  type: "telegram",
  label: "Telegram",
  buildPayload(digest, channel, deliveredAt) {
    const text = buildTelegramDigestHtml(
      buildDigestChatMessage(digest, deliveredAt)
    );

    return {
      body: JSON.stringify({
        chat_id: channel.chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true }
      }),
      contentType: "application/json; charset=utf-8",
      preview: text
    };
  },
  send(channel, payload) {
    if (!channel.botToken) {
      throw new Error("Telegram 渠道缺少 bot token。");
    }

    // The token sits in the path, so this URL is built here and nowhere
    // else; it is never returned, logged or stored.
    return postAdapterPayload(
      channel,
      payload,
      `${getTelegramApiBase(channel)}/bot${channel.botToken}/sendMessage`
    );
  },
  validateChannelConfig(config) {
    const issues: string[] = [];
    const base = config.endpointUrl.trim();

    if (base && !isMockEndpoint(base) && !isHttpUrl(base)) {
      issues.push("Telegram API 地址必须是 http(s) 地址，或留空使用官方地址。");
    }

    if (!config.botToken?.trim()) {
      issues.push("Telegram 渠道需要 bot token。");
    } else if (!telegramTokenPattern.test(config.botToken.trim())) {
      issues.push("bot token 的格式应为「数字 id:密钥」，可在 @BotFather 处获取。");
    }

    if (!config.chatId?.trim()) {
      issues.push("Telegram 渠道需要 chat id。");
    } else if (!telegramChatIdPattern.test(config.chatId.trim())) {
      issues.push("chat id 应为数字（群组以 - 开头）或 @频道用户名。");
    }

    return issues;
  }
};
