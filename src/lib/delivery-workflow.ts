import { randomUUID } from "node:crypto";

import {
  getDeliveryAdapter,
  getSupportedDeliveryChannelTypes
} from "@/lib/delivery/adapters";
import { defaultTelegramApiBase } from "@/lib/delivery/adapters/telegram";
import { getDailyDigestByDate } from "@/lib/digest-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import {
  maskEndpointUrl,
  maskSecretsInText,
  maskTelegramBotToken
} from "@/lib/secret-masking";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryChannelType,
  DeliveryFormat,
  DeliveryRun,
  DeliveryStatus,
  StoredDeliveryChannel
} from "@/types/content";

export { buildDailyDigestWebhookPayload } from "@/lib/delivery/digest-payload";
export { maskEndpointUrl };

interface DeliveryStore {
  updatedAt: string;
  channels: StoredDeliveryChannel[];
  runs: DeliveryRun[];
}

export interface DeliveryChannelInput {
  name: string;
  type: DeliveryChannelType;
  enabled: boolean;
  endpointUrl: string;
  description?: string;
  format: DeliveryFormat;
  /** Telegram only. Blank on an update keeps the stored token. */
  botToken?: string;
  chatId?: string;
}

// Telegram and Discord send one fixed message shape, as Feishu does, so the
// channel's format is always text for them.
const fixedTextFormatTypes: DeliveryChannelType[] = [
  "feishu_webhook",
  "telegram",
  "discord"
];

export class DeliveryChannelValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super("投递渠道校验失败。");
    this.name = "DeliveryChannelValidationError";
    this.issues = issues;
  }
}

export class DeliverySendError extends Error {
  run?: DeliveryRun;

  constructor(message: string, run?: DeliveryRun) {
    super(message);
    this.name = "DeliverySendError";
    this.run = run;
  }
}

const deliveryStorePath = getLocalStoreFilePath("delivery.json");
const supportedChannelTypes: DeliveryChannelType[] =
  getSupportedDeliveryChannelTypes();
const allowedChannelTypes: DeliveryChannelType[] = [
  "webhook",
  "feishu_webhook",
  "email",
  "telegram",
  "discord"
];
const allowedFormats: DeliveryFormat[] = ["json", "text"];
const channelErrorLabels: Partial<Record<DeliveryChannelType, string>> = {
  webhook: "Webhook",
  feishu_webhook: "Feishu webhook",
  telegram: "Telegram Bot API",
  discord: "Discord webhook"
};
const previewLength = 1600;

function getTimestamp(): string {
  return new Date().toISOString();
}

function getDefaultDeliveryStore(): DeliveryStore {
  const now = getTimestamp();

  return {
    updatedAt: now,
    channels: [
      {
        id: "local-mock-webhook",
        name: "Local mock webhook",
        type: "webhook",
        enabled: true,
        endpointUrl: "mock://success",
        description:
          "Local validation channel. It simulates a successful webhook without calling an external service.",
        format: "json",
        createdAt: now,
        updatedAt: now
      }
    ],
    runs: []
  };
}

function truncate(value: string, maxLength = previewLength): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatus | undefined {
  return value === "pending" || value === "success" || value === "failed"
    ? value
    : undefined;
}

function normalizeChannelType(value: unknown): DeliveryChannelType {
  if (value === "feishu") {
    return "feishu_webhook";
  }

  return allowedChannelTypes.includes(value as DeliveryChannelType)
    ? (value as DeliveryChannelType)
    : "webhook";
}

function normalizeDeliveryFormat(value: unknown): DeliveryFormat {
  return allowedFormats.includes(value as DeliveryFormat)
    ? (value as DeliveryFormat)
    : "json";
}

function normalizeDeliveryChannel(
  record: Record<string, unknown>
): StoredDeliveryChannel {
  const now = getTimestamp();
  const type = normalizeChannelType(record.type);

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id
        : `delivery-channel-${randomUUID()}`,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : "未命名投递渠道",
    type,
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    endpointUrl:
      typeof record.endpointUrl === "string" ? record.endpointUrl.trim() : "",
    description:
      typeof record.description === "string"
        ? record.description.trim()
        : undefined,
    format:
      record.format === undefined && fixedTextFormatTypes.includes(type)
        ? "text"
        : normalizeDeliveryFormat(record.format),
    chatId:
      typeof record.chatId === "string" && record.chatId.trim()
        ? record.chatId.trim()
        : undefined,
    botToken:
      typeof record.botToken === "string" && record.botToken.trim()
        ? record.botToken.trim()
        : undefined,
    lastDeliveredAt:
      typeof record.lastDeliveredAt === "string"
        ? record.lastDeliveredAt
        : undefined,
    lastDeliveryStatus: normalizeDeliveryStatus(record.lastDeliveryStatus),
    lastDeliveryMessage:
      typeof record.lastDeliveryMessage === "string"
        ? record.lastDeliveryMessage
        : undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now
  };
}

function normalizeDeliveryRun(record: Record<string, unknown>): DeliveryRun {
  const now = getTimestamp();
  const status = normalizeDeliveryStatus(record.status);

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id
        : `delivery-run-${randomUUID()}`,
    digestId: typeof record.digestId === "string" ? record.digestId : "",
    digestDate: typeof record.digestDate === "string" ? record.digestDate : "",
    channelId: typeof record.channelId === "string" ? record.channelId : "",
    channelName:
      typeof record.channelName === "string" ? record.channelName : "",
    channelType: normalizeChannelType(record.channelType),
    status: status ?? "failed",
    startedAt: typeof record.startedAt === "string" ? record.startedAt : now,
    finishedAt:
      typeof record.finishedAt === "string" ? record.finishedAt : undefined,
    requestPayloadPreview:
      typeof record.requestPayloadPreview === "string"
        ? record.requestPayloadPreview
        : "",
    responseStatus:
      typeof record.responseStatus === "number"
        ? record.responseStatus
        : undefined,
    responseBodyPreview:
      typeof record.responseBodyPreview === "string"
        ? record.responseBodyPreview
        : undefined,
    errorMessage:
      typeof record.errorMessage === "string" ? record.errorMessage : undefined,
    retryOfDeliveryRunId:
      typeof record.retryOfDeliveryRunId === "string"
        ? record.retryOfDeliveryRunId
        : undefined
  };
}

function readDeliveryStore(): DeliveryStore {
  const store = readJsonFile<DeliveryStore>(
    deliveryStorePath,
    getDefaultDeliveryStore()
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    channels: (store.channels ?? []).map((channel) =>
      normalizeDeliveryChannel(channel as unknown as Record<string, unknown>)
    ),
    runs: (store.runs ?? [])
      .map((run) =>
        normalizeDeliveryRun(run as unknown as Record<string, unknown>)
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  };
}

function writeDeliveryStore(store: DeliveryStore) {
  writeJsonFile(deliveryStorePath, {
    updatedAt: getTimestamp(),
    channels: store.channels.sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    runs: store.runs.sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    )
  });
}

function isValidEndpointUrl(value: string): boolean {
  if (value.startsWith("mock://success") || value.startsWith("mock://failed")) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The token the channel will send with: the input's, else the stored one. */
function resolveBotToken(
  input: DeliveryChannelInput,
  existing?: StoredDeliveryChannel
): string | undefined {
  if (input.type !== "telegram") {
    return undefined;
  }

  return input.botToken?.trim() || existing?.botToken;
}

function validateDeliveryChannelInput(
  input: DeliveryChannelInput,
  existing?: StoredDeliveryChannel
) {
  const issues: string[] = [];

  if (!input.name.trim()) {
    issues.push("渠道名称为必填项。");
  }

  if (!allowedChannelTypes.includes(input.type)) {
    issues.push("不支持该渠道类型。");
  }

  const adapter = getDeliveryAdapter(input.type);

  if (!supportedChannelTypes.includes(input.type) || !adapter) {
    issues.push(
      "当前版本支持通用 Webhook、飞书 Webhook、Telegram 与 Discord 渠道。"
    );
  }

  // A Telegram channel's endpoint is the Bot API base and may be left blank
  // for the official one; every other type needs its webhook address.
  if (input.type !== "telegram") {
    if (!input.endpointUrl.trim()) {
      issues.push("端点 URL 为必填项。");
    } else if (!isValidEndpointUrl(input.endpointUrl)) {
      issues.push("端点 URL 必须是 http(s) 或本地 mock 端点。");
    }
  }

  if (!allowedFormats.includes(input.format)) {
    issues.push("投递格式必须是 json 或 text。");
  }

  if (adapter) {
    issues.push(
      ...adapter.validateChannelConfig({
        type: input.type,
        endpointUrl: input.endpointUrl,
        format: input.format,
        botToken: resolveBotToken(input, existing),
        chatId: input.chatId
      })
    );
  }

  if (issues.length > 0) {
    throw new DeliveryChannelValidationError(issues);
  }
}

export function coerceDeliveryChannelInput(
  record: Record<string, unknown>
): DeliveryChannelInput {
  const type = normalizeChannelType(record.type);

  return {
    name: String(record.name ?? "").trim(),
    type,
    enabled: record.enabled === true || record.enabled === "on",
    endpointUrl: String(record.endpointUrl ?? "").trim(),
    description: String(record.description ?? "").trim() || undefined,
    format: fixedTextFormatTypes.includes(type)
      ? "text"
      : normalizeDeliveryFormat(record.format),
    botToken:
      type === "telegram"
        ? String(record.botToken ?? "").trim() || undefined
        : undefined,
    chatId:
      type === "telegram"
        ? String(record.chatId ?? "").trim() || undefined
        : undefined
  };
}

/**
 * The shape every caller outside this module sees: the bot token replaced by
 * `botTokenMasked`. Pages pass channels to client components, so a token in
 * this object would reach the browser in the RSC payload.
 */
export function toClientDeliveryChannel(
  channel: StoredDeliveryChannel
): DeliveryChannel {
  const { botToken, ...rest } = channel;

  return {
    ...rest,
    botTokenMasked: botToken ? maskTelegramBotToken(botToken) : undefined
  };
}

/**
 * The channel with its secrets. Besides this workflow, only
 * `src/lib/ops-alert.ts` calls it — to hand the channel straight to an
 * adapter's `send`. Never return the result from a page or an API route;
 * those get `getDeliveryChannelById`.
 */
export function getStoredDeliveryChannelById(
  channelId: string
): StoredDeliveryChannel | undefined {
  return readDeliveryStore().channels.find(
    (channel) => channel.id === channelId
  );
}

export function getDeliveryChannels(): DeliveryChannel[] {
  return readDeliveryStore().channels.map(toClientDeliveryChannel);
}

export function getEnabledDeliveryChannels(): DeliveryChannel[] {
  return getDeliveryChannels().filter((channel) => channel.enabled);
}

export function getDeliveryChannelById(
  channelId: string
): DeliveryChannel | undefined {
  const channel = getStoredDeliveryChannelById(channelId);

  return channel ? toClientDeliveryChannel(channel) : undefined;
}

export function getDeliveryRuns(): DeliveryRun[] {
  return readDeliveryStore().runs;
}

export function getDeliveryRunsForDigest(digestDate: string): DeliveryRun[] {
  return getDeliveryRuns().filter((run) => run.digestDate === digestDate);
}

function buildStoredChannel(
  input: DeliveryChannelInput,
  base: Pick<StoredDeliveryChannel, "id" | "createdAt"> &
    Partial<StoredDeliveryChannel>,
  existing?: StoredDeliveryChannel
): StoredDeliveryChannel {
  const isTelegram = input.type === "telegram";

  return {
    ...base,
    name: input.name.trim(),
    type: input.type,
    enabled: input.enabled,
    // Stored explicitly so the channel list shows where it sends.
    endpointUrl:
      input.endpointUrl.trim() || (isTelegram ? defaultTelegramApiBase : ""),
    description: input.description,
    format: fixedTextFormatTypes.includes(input.type) ? "text" : input.format,
    chatId: isTelegram ? input.chatId?.trim() : undefined,
    botToken: isTelegram ? resolveBotToken(input, existing) : undefined,
    updatedAt: getTimestamp()
  };
}

export function createDeliveryChannel(
  input: DeliveryChannelInput
): DeliveryChannel {
  validateDeliveryChannelInput(input);

  const store = readDeliveryStore();
  const now = getTimestamp();
  const channel = buildStoredChannel(input, {
    id: `delivery-channel-${randomUUID()}`,
    createdAt: now
  });

  writeDeliveryStore({
    updatedAt: now,
    channels: [...store.channels, channel],
    runs: store.runs
  });

  return toClientDeliveryChannel(channel);
}

export function updateDeliveryChannel(
  channelId: string,
  input: DeliveryChannelInput
): DeliveryChannel {
  const store = readDeliveryStore();
  const existingChannel = store.channels.find(
    (channel) => channel.id === channelId
  );

  if (!existingChannel) {
    throw new Error(`未找到投递渠道 ${channelId}。`);
  }

  validateDeliveryChannelInput(input, existingChannel);

  const nextChannel = buildStoredChannel(
    input,
    existingChannel,
    existingChannel
  );

  writeDeliveryStore({
    updatedAt: getTimestamp(),
    channels: [
      ...store.channels.filter((channel) => channel.id !== channelId),
      nextChannel
    ],
    runs: store.runs
  });

  return toClientDeliveryChannel(nextChannel);
}

export function setDeliveryChannelEnabled(
  channelId: string,
  enabled: boolean
): DeliveryChannel {
  const store = readDeliveryStore();
  const existingChannel = store.channels.find(
    (channel) => channel.id === channelId
  );

  if (!existingChannel) {
    throw new Error(`未找到投递渠道 ${channelId}。`);
  }

  const nextChannel: StoredDeliveryChannel = {
    ...existingChannel,
    enabled,
    updatedAt: getTimestamp()
  };

  writeDeliveryStore({
    updatedAt: getTimestamp(),
    channels: [
      ...store.channels.filter((channel) => channel.id !== channelId),
      nextChannel
    ],
    runs: store.runs
  });

  return toClientDeliveryChannel(nextChannel);
}

export function buildDeliveryRequestPayload(
  digest: DailyDigest,
  channel: DeliveryChannel,
  deliveredAt = getTimestamp()
): { body: string; contentType: string; preview: string } {
  const adapter = getDeliveryAdapter(channel.type);

  if (!adapter) {
    throw new Error("当前版本尚未实现该投递渠道类型。");
  }

  const payload = adapter.buildPayload(digest, channel, deliveredAt);

  return {
    body: payload.body,
    contentType: payload.contentType,
    preview: truncate(payload.preview ?? payload.body)
  };
}

function persistDeliveryRun(
  run: DeliveryRun,
  channelId: string,
  rawMessage: string
): DeliveryRun {
  const store = readDeliveryStore();
  // Re-read the stored channel rather than spreading the caller's copy, so
  // the write keeps the token and any edit made while the request was out.
  const channel = store.channels.find((item) => item.id === channelId);
  const message = maskSecretsInText(rawMessage);

  if (!channel) {
    throw new Error(`未找到投递渠道 ${channelId}。`);
  }

  const nextChannel: StoredDeliveryChannel = {
    ...channel,
    lastDeliveredAt:
      run.status === "success" ? run.finishedAt : channel.lastDeliveredAt,
    lastDeliveryStatus: run.status,
    lastDeliveryMessage: message,
    updatedAt: getTimestamp()
  };

  writeDeliveryStore({
    updatedAt: getTimestamp(),
    channels: [
      ...store.channels.filter((item) => item.id !== channel.id),
      nextChannel
    ],
    runs: [
      run,
      ...store.runs.filter((existingRun) => existingRun.id !== run.id)
    ]
  });

  tryRecordWorkflowEvent({
    entityType: "delivery_run",
    entityId: run.id,
    action: run.status === "success" ? "delivery.sent" : "delivery.failed",
    actorType: "workspace_user",
    afterSnapshot: run,
    metadata: {
      digestId: run.digestId,
      digestDate: run.digestDate,
      channelId: run.channelId,
      channelType: run.channelType,
      status: run.status,
      message
    }
  });

  return run;
}

export function getDeliveryPreview(digestDate: string, channelId: string) {
  const digest = getDailyDigestByDate(digestDate);
  const channel = getDeliveryChannelById(channelId);

  if (!digest) {
    throw new Error(`未找到 ${digestDate} 的简报。`);
  }

  if (digest.status !== "published") {
    throw new Error("只有已发布的简报可以预览投递。");
  }

  if (!channel) {
    throw new Error(`未找到投递渠道 ${channelId}。`);
  }

  const { preview, contentType } = buildDeliveryRequestPayload(digest, channel);

  return {
    channel,
    contentType,
    requestPayloadPreview: preview
  };
}

export async function sendDailyDigestToChannel({
  digestDate,
  channelId,
  retryOfDeliveryRunId
}: {
  digestDate: string;
  channelId: string;
  retryOfDeliveryRunId?: string;
}): Promise<DeliveryRun> {
  const digest = getDailyDigestByDate(digestDate);
  const channel = getStoredDeliveryChannelById(channelId);

  if (!digest) {
    throw new Error(`未找到 ${digestDate} 的简报。`);
  }

  if (digest.status !== "published") {
    throw new Error("只有已发布的简报可以投递。");
  }

  if (!channel) {
    throw new Error(`未找到投递渠道 ${channelId}。`);
  }

  if (!channel.enabled) {
    throw new Error("投递渠道已停用。");
  }

  const startedAt = getTimestamp();
  const baseRun: DeliveryRun = {
    id: `delivery-run-${randomUUID()}`,
    digestId: digest.id,
    digestDate: digest.date,
    channelId: channel.id,
    channelName: channel.name,
    channelType: channel.type,
    status: "pending",
    startedAt,
    requestPayloadPreview: "",
    retryOfDeliveryRunId
  };
  const adapter = getDeliveryAdapter(channel.type);

  if (!adapter) {
    const finishedAt = getTimestamp();
    const run: DeliveryRun = {
      ...baseRun,
      status: "failed",
      finishedAt,
      errorMessage: "当前版本尚未实现该投递渠道类型。"
    };

    persistDeliveryRun(run, channel.id, "当前版本尚未实现该投递渠道类型。");

    return run;
  }

  const deliveredAt = startedAt;
  const { body, contentType, preview } = buildDeliveryRequestPayload(
    digest,
    channel,
    deliveredAt
  );
  const pendingRun: DeliveryRun = {
    ...baseRun,
    requestPayloadPreview: preview
  };

  try {
    const response = await adapter.send(channel, { body, contentType });
    const responseText = truncate(
      maskSecretsInText(response.bodyPreview),
      1000
    );
    const finishedAt = getTimestamp();
    const channelLabel = channelErrorLabels[channel.type] ?? "Webhook";

    if (!response.ok) {
      const run: DeliveryRun = {
        ...pendingRun,
        status: "failed",
        finishedAt,
        responseStatus: response.status,
        responseBodyPreview: responseText,
        errorMessage: `${channelLabel} returned HTTP ${
          response.status ?? "unknown"
        }.`
      };

      persistDeliveryRun(run, channel.id, run.errorMessage ?? "投递失败。");

      return run;
    }

    const run: DeliveryRun = {
      ...pendingRun,
      status: "success",
      finishedAt,
      responseStatus: response.status,
      responseBodyPreview: responseText
    };

    return persistDeliveryRun(run, channel.id, "投递成功。");
  } catch (error) {
    const finishedAt = getTimestamp();
    const errorMessage = maskSecretsInText(
      error instanceof Error ? error.message : "未知投递错误。"
    );
    const run: DeliveryRun = {
      ...pendingRun,
      status: "failed",
      finishedAt,
      errorMessage
    };

    persistDeliveryRun(run, channel.id, errorMessage);

    return run;
  }
}

export async function retryDeliveryRun(runId: string): Promise<DeliveryRun> {
  const existingRun = getDeliveryRuns().find((run) => run.id === runId);

  if (!existingRun) {
    throw new Error(`未找到投递记录 ${runId}。`);
  }

  return sendDailyDigestToChannel({
    digestDate: existingRun.digestDate,
    channelId: existingRun.channelId,
    retryOfDeliveryRunId: existingRun.id
  });
}
