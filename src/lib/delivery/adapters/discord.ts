import type { DailyDigestWebhookTechnology } from "@/lib/delivery/digest-payload";

import {
  buildDigestChatMessage,
  fitBlocks,
  truncatePlainText,
  type DigestChatMessage
} from "./digest-message";
import { isHttpUrl, isMockEndpoint, postAdapterPayload } from "./shared";
import type { DeliveryAdapter } from "./types";

// A Discord webhook message with one embed: the title links to the digest,
// the description carries the summary and the link, and two fields list the
// first three items of each section. Discord's limits: embed title 256,
// description 4096, field value 1024, all embed text together 6000.

export const discordLimits = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  embedTotal: 6000
} as const;

const summaryLimit = 2000;
const embedColor = 0x2f6f5e;
const webhookPathPattern = /^\/api\/webhooks\/\d+\/[A-Za-z0-9_.-]+\/?$/;

export interface DiscordEmbed {
  title: string;
  url: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
}

/** Backslash-escapes Discord markdown so titles cannot break a link or a style. */
export function escapeDiscordMarkdown(value: string): string {
  return value.replace(/([\\*_~`|>[\]()])/g, "\\$1");
}

function formatItem(item: DailyDigestWebhookTechnology, index: number) {
  const title = escapeDiscordMarkdown(truncatePlainText(item.title, 120));
  const reason = escapeDiscordMarkdown(
    truncatePlainText(item.reason || item.summary, 140)
  );

  return `**${index + 1}.** [${title}](${item.url})\n${reason}`;
}

function buildField(
  name: string,
  items: DailyDigestWebhookTechnology[],
  emptyText: string
) {
  return {
    name,
    value:
      items.length > 0
        ? fitBlocks(items.map(formatItem), "", discordLimits.fieldValue)
        : emptyText
  };
}

export function buildDiscordDigestEmbed(
  message: DigestChatMessage
): DiscordEmbed {
  const link = `\n\n[阅读全文](${message.digestUrl})`;

  return {
    title: truncatePlainText(message.title, discordLimits.title),
    url: message.digestUrl,
    description: fitBlocks(
      [escapeDiscordMarkdown(truncatePlainText(message.summary, summaryLimit))],
      link,
      discordLimits.description
    ),
    color: embedColor,
    fields: [
      buildField("今日立即关注", message.highPriorityItems, "暂无立即关注内容。"),
      buildField("值得跟踪", message.watchItems, "暂无值得跟踪内容。")
    ],
    footer: { text: `技术简报 · ${message.date}` }
  };
}

/** Characters Discord counts against the 6000 limit. */
export function countDiscordEmbedCharacters(embed: DiscordEmbed): number {
  return (
    embed.title.length +
    embed.description.length +
    embed.footer.text.length +
    embed.fields.reduce(
      (total, field) => total + field.name.length + field.value.length,
      0
    )
  );
}

function embedToPreview(embed: DiscordEmbed): string {
  return [
    embed.title,
    "",
    embed.description,
    ...embed.fields.flatMap((field) => ["", `${field.name}：`, field.value]),
    "",
    embed.footer.text
  ].join("\n");
}

export const discordAdapter: DeliveryAdapter = {
  type: "discord",
  label: "Discord",
  buildPayload(digest, _channel, deliveredAt) {
    const embed = buildDiscordDigestEmbed(
      buildDigestChatMessage(digest, deliveredAt)
    );

    return {
      body: JSON.stringify({
        embeds: [embed],
        // A digest title is never meant to ping anyone.
        allowed_mentions: { parse: [] }
      }),
      contentType: "application/json; charset=utf-8",
      preview: embedToPreview(embed)
    };
  },
  send(channel, payload) {
    return postAdapterPayload(channel, payload);
  },
  validateChannelConfig(config) {
    const endpoint = config.endpointUrl.trim();

    if (isMockEndpoint(endpoint)) {
      return [];
    }

    if (!isHttpUrl(endpoint)) {
      return ["Discord webhook 地址必须是 http(s) 地址。"];
    }

    return webhookPathPattern.test(new URL(endpoint).pathname)
      ? []
      : ["Discord webhook 地址应形如 https://discord.com/api/webhooks/<id>/<token>。"];
  }
};
