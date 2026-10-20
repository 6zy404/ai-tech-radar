import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

import { getDeliveryAdapter } from "@/lib/delivery/adapters";
import { truncatePlainText } from "@/lib/delivery/adapters/digest-message";
import {
  discordLimits,
  escapeDiscordMarkdown
} from "@/lib/delivery/adapters/discord";
import {
  escapeTelegramHtml,
  telegramMessageLimit
} from "@/lib/delivery/adapters/telegram";
import type { DeliveryAdapterPayload } from "@/lib/delivery/adapters/types";
import { getStoredDeliveryChannelById } from "@/lib/delivery-workflow";
import { maskSecretsInText } from "@/lib/secret-masking";
import type {
  DeliveryChannelType,
  StoredDeliveryChannel
} from "@/types/content";

/**
 * Off-site operations alerts (2026-10-20).
 *
 * `npm run check:pipeline` only ever showed a Windows toast, and the tunnel
 * was down for two and a half days (2026-10-17 → 10-20) with nobody at the
 * desk to see one. This module sends a plain-text alert — title, body, time —
 * through one of the delivery channels already configured for the digest
 * (`config/delivery.json`): webhook, Feishu, Telegram or Discord. The channel
 * is chosen by `OPS_ALERT_CHANNEL_ID`; unset, nothing is sent and the caller
 * is told so in one line.
 *
 * It reuses the adapters' `send` (mock endpoints, the Telegram request URL,
 * the 15-second timeout) but builds its own payload: an alert is not a digest.
 * Every piece of text goes through `maskSecretsInText` on the way in and out.
 */

export const opsAlertChannelEnvName = "OPS_ALERT_CHANNEL_ID";
export const opsAlertTimeZone = "Asia/Shanghai";

/** `process.env` or a subset of it; the type stays loose so a test can pass `{}`. */
export type OpsAlertEnv = Record<string, string | undefined>;

const titleLimit = 200;
const bodyLimit = 3000;

export interface OpsAlert {
  title: string;
  body: string;
  /** When the alert happened; defaults to now. */
  at?: Date;
}

export type OpsAlertStatus =
  | "sent"
  | "failed"
  | "not_configured"
  | "channel_not_found"
  | "channel_disabled"
  | "unsupported";

export interface OpsAlertResult {
  status: OpsAlertStatus;
  /** One line for a log; secrets masked. */
  message: string;
  channelId?: string;
  channelName?: string;
  channelType?: DeliveryChannelType;
  responseStatus?: number;
}

export interface OpsAlertText {
  title: string;
  body: string;
  time: string;
}

/**
 * Reads `OPS_ALERT_CHANNEL_ID` from the environment, else from `.env.local`
 * under the project root (the current directory, as for every script here —
 * never a fixed path). The scripts that send alerts run under plain Node,
 * which never loads `.env.local`; the owner keeps the channel id there with
 * the other machine-specific settings. The file is read with Node's own
 * dotenv parser — the one `process.loadEnvFile` uses in the eval scripts —
 * into a local object rather than `process.env`, and only this key is taken.
 */
export function getOpsAlertChannelId(
  env: OpsAlertEnv = process.env,
  projectRoot = process.cwd()
): string | undefined {
  const fromEnv = env[opsAlertChannelEnvName]?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  const envFile = path.join(projectRoot, ".env.local");

  if (!existsSync(envFile)) {
    return undefined;
  }

  const fromFile = parseEnv(readFileSync(envFile, "utf8"))[
    opsAlertChannelEnvName
  ]?.trim();

  return fromFile || undefined;
}

export function formatOpsAlertTime(
  date: Date,
  timeZone = opsAlertTimeZone
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`;
}

/** The three pieces every channel sends, masked and cut to size. */
export function buildOpsAlertText(alert: OpsAlert): OpsAlertText {
  const title = truncatePlainText(
    maskSecretsInText(alert.title.trim() || "AI Tech Radar 运维告警"),
    titleLimit
  );
  const body = truncatePlainText(maskSecretsInText(alert.body), bodyLimit);

  return {
    title,
    body,
    time: formatOpsAlertTime(alert.at ?? new Date())
  };
}

export function toOpsAlertPlainText(text: OpsAlertText): string {
  return [text.title, "", text.body, "", `时间：${text.time}`].join("\n");
}

/**
 * Telegram rejects a message over 4096 characters and one with a broken
 * entity, so the body is cut as plain text and escaped afterwards — never
 * cut after escaping, which could leave half an `&amp;`. Escaping can grow
 * the text, so the cut is repeated until the whole message fits.
 */
export function buildTelegramOpsAlertHtml(
  text: OpsAlertText,
  limit = telegramMessageLimit
): string {
  const render = (body: string) =>
    [
      `<b>${escapeTelegramHtml(text.title)}</b>`,
      "",
      escapeTelegramHtml(body),
      "",
      `时间：${escapeTelegramHtml(text.time)}`
    ].join("\n");
  let body = text.body;
  let html = render(body);

  for (let attempt = 0; html.length > limit && attempt < 8; attempt += 1) {
    const room = Math.max(0, body.length - (html.length - limit));

    body = room < 2 ? "" : truncatePlainText(body, room);
    html = render(body);
  }

  return html;
}

export function buildOpsAlertPayload(
  channel: StoredDeliveryChannel,
  text: OpsAlertText
): DeliveryAdapterPayload {
  const plain = toOpsAlertPlainText(text);

  switch (channel.type) {
    case "webhook":
      return channel.format === "text"
        ? {
            body: plain,
            contentType: "text/plain; charset=utf-8",
            preview: plain
          }
        : {
            body: JSON.stringify(
              {
                kind: "ops_alert",
                title: text.title,
                body: text.body,
                time: text.time
              },
              null,
              2
            ),
            contentType: "application/json; charset=utf-8",
            preview: plain
          };
    case "feishu_webhook":
      return {
        body: JSON.stringify({ msg_type: "text", content: { text: plain } }),
        contentType: "application/json; charset=utf-8",
        preview: plain
      };
    case "telegram":
      return {
        body: JSON.stringify({
          chat_id: channel.chatId,
          text: buildTelegramOpsAlertHtml(text),
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true }
        }),
        contentType: "application/json; charset=utf-8",
        preview: plain
      };
    case "discord":
      return {
        body: JSON.stringify({
          embeds: [
            {
              title: truncatePlainText(text.title, discordLimits.title),
              description: truncatePlainText(
                escapeDiscordMarkdown(text.body),
                discordLimits.description
              ),
              color: 0xb3261e,
              footer: {
                text: truncatePlainText(text.time, discordLimits.footer)
              }
            }
          ],
          // An alert is never meant to ping anyone.
          allowed_mentions: { parse: [] }
        }),
        contentType: "application/json; charset=utf-8",
        preview: plain
      };
    default:
      throw new Error(`投递渠道类型 ${channel.type} 不支持运维告警。`);
  }
}

export interface SendOpsAlertOptions {
  /** Overrides `OPS_ALERT_CHANNEL_ID`. */
  channelId?: string;
  /** Build everything, send nothing. */
  dryRun?: boolean;
  env?: OpsAlertEnv;
  projectRoot?: string;
}

/**
 * Sends one alert through the configured channel. Never throws: the result's
 * `status` and `message` say what happened, so a caller in a cron script can
 * log one line and carry on.
 */
export async function sendOpsAlert(
  alert: OpsAlert,
  options: SendOpsAlertOptions = {}
): Promise<OpsAlertResult> {
  const channelId =
    options.channelId?.trim() ||
    getOpsAlertChannelId(options.env ?? process.env, options.projectRoot);

  if (!channelId) {
    return {
      status: "not_configured",
      message: `未设置 ${opsAlertChannelEnvName}，站外告警未发送。`
    };
  }

  const channel = getStoredDeliveryChannelById(channelId);

  if (!channel) {
    return {
      status: "channel_not_found",
      channelId,
      message: `未找到投递渠道 ${channelId}（${opsAlertChannelEnvName}），站外告警未发送。`
    };
  }

  const base = {
    channelId: channel.id,
    channelName: channel.name,
    channelType: channel.type
  };

  if (!channel.enabled) {
    return {
      ...base,
      status: "channel_disabled",
      message: `投递渠道「${channel.name}」已停用，站外告警未发送。`
    };
  }

  const adapter = getDeliveryAdapter(channel.type);

  if (!adapter) {
    return {
      ...base,
      status: "unsupported",
      message: `投递渠道「${channel.name}」的类型 ${channel.type} 不支持发送，站外告警未发送。`
    };
  }

  const text = buildOpsAlertText(alert);
  const payload = buildOpsAlertPayload(channel, text);

  if (options.dryRun) {
    return {
      ...base,
      status: "sent",
      message: `（dry-run）本应经「${channel.name}」（${channel.type}）发送：${text.title}`
    };
  }

  try {
    const response = await adapter.send(channel, {
      body: payload.body,
      contentType: payload.contentType
    });
    const bodyPreview = truncatePlainText(
      maskSecretsInText(response.bodyPreview ?? ""),
      200
    );

    if (!response.ok) {
      return {
        ...base,
        status: "failed",
        responseStatus: response.status,
        message: `站外告警经「${channel.name}」发送失败：HTTP ${
          response.status ?? "unknown"
        }${bodyPreview ? ` ${bodyPreview}` : ""}`
      };
    }

    return {
      ...base,
      status: "sent",
      responseStatus: response.status,
      message: `站外告警已经「${channel.name}」（${channel.type}）发送：${text.title}`
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      message: `站外告警经「${channel.name}」发送失败：${maskSecretsInText(
        error instanceof Error ? error.message : String(error)
      )}`
    };
  }
}
