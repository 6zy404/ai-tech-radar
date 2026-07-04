import { randomUUID } from "node:crypto";

import {
  getDeliveryAdapter,
  getSupportedDeliveryChannelTypes
} from "@/lib/delivery/adapters";
import { getDailyDigestByDate } from "@/lib/digest-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryChannelType,
  DeliveryFormat,
  DeliveryRun,
  DeliveryStatus
} from "@/types/content";

export { buildDailyDigestWebhookPayload } from "@/lib/delivery/digest-payload";

interface DeliveryStore {
  updatedAt: string;
  channels: DeliveryChannel[];
  runs: DeliveryRun[];
}

export interface DeliveryChannelInput {
  name: string;
  type: DeliveryChannelType;
  enabled: boolean;
  endpointUrl: string;
  description?: string;
  format: DeliveryFormat;
}

export class DeliveryChannelValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super("Delivery channel validation failed.");
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
): DeliveryChannel {
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
        : "Untitled delivery channel",
    type,
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    endpointUrl:
      typeof record.endpointUrl === "string" ? record.endpointUrl.trim() : "",
    description:
      typeof record.description === "string"
        ? record.description.trim()
        : undefined,
    format:
      record.format === undefined && type === "feishu_webhook"
        ? "text"
        : normalizeDeliveryFormat(record.format),
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

function validateDeliveryChannelInput(input: DeliveryChannelInput) {
  const issues: string[] = [];

  if (!input.name.trim()) {
    issues.push("Channel name is required.");
  }

  if (!allowedChannelTypes.includes(input.type)) {
    issues.push("Channel type is not supported.");
  }

  const adapter = getDeliveryAdapter(input.type);

  if (!supportedChannelTypes.includes(input.type) || !adapter) {
    issues.push(
      "Only generic webhook and Feishu webhook channels can be sent in this version."
    );
  }

  if (!input.endpointUrl.trim()) {
    issues.push("Endpoint URL is required.");
  } else if (!isValidEndpointUrl(input.endpointUrl)) {
    issues.push("Endpoint URL must be http(s) or a local mock endpoint.");
  }

  if (!allowedFormats.includes(input.format)) {
    issues.push("Delivery format must be json or text.");
  }

  if (adapter) {
    issues.push(...adapter.validateChannelConfig(input));
  }

  if (issues.length > 0) {
    throw new DeliveryChannelValidationError(issues);
  }
}

export function coerceDeliveryChannelInput(
  record: Record<string, unknown>
): DeliveryChannelInput {
  return {
    name: String(record.name ?? "").trim(),
    type: normalizeChannelType(record.type),
    enabled: record.enabled === true || record.enabled === "on",
    endpointUrl: String(record.endpointUrl ?? "").trim(),
    description: String(record.description ?? "").trim() || undefined,
    format: normalizeDeliveryFormat(record.format)
  };
}

export function getDeliveryChannels(): DeliveryChannel[] {
  return readDeliveryStore().channels;
}

export function getEnabledDeliveryChannels(): DeliveryChannel[] {
  return getDeliveryChannels().filter((channel) => channel.enabled);
}

export function getDeliveryChannelById(
  channelId: string
): DeliveryChannel | undefined {
  return getDeliveryChannels().find((channel) => channel.id === channelId);
}

export function getDeliveryRuns(): DeliveryRun[] {
  return readDeliveryStore().runs;
}

export function getDeliveryRunsForDigest(digestDate: string): DeliveryRun[] {
  return getDeliveryRuns().filter((run) => run.digestDate === digestDate);
}

export function maskEndpointUrl(endpointUrl: string): string {
  if (endpointUrl.startsWith("mock://")) {
    return endpointUrl.replace(
      /(token|key|secret|signature|auth)=([^&\s]+)/gi,
      "$1=***"
    );
  }

  try {
    const url = new URL(endpointUrl);

    if (url.username) {
      url.username = "***";
    }

    if (url.password) {
      url.password = "***";
    }

    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|key|secret|signature|auth/i.test(key)) {
        url.searchParams.set(key, "***");
      }
    }

    return url.toString();
  } catch {
    return endpointUrl.replace(
      /(token|key|secret|signature|auth)=([^&\s]+)/gi,
      "$1=***"
    );
  }
}

export function createDeliveryChannel(
  input: DeliveryChannelInput
): DeliveryChannel {
  validateDeliveryChannelInput(input);

  const store = readDeliveryStore();
  const now = getTimestamp();
  const channel: DeliveryChannel = {
    id: `delivery-channel-${randomUUID()}`,
    name: input.name.trim(),
    type: input.type,
    enabled: input.enabled,
    endpointUrl: input.endpointUrl.trim(),
    description: input.description,
    format: input.format,
    createdAt: now,
    updatedAt: now
  };

  writeDeliveryStore({
    updatedAt: now,
    channels: [...store.channels, channel],
    runs: store.runs
  });

  return channel;
}

export function updateDeliveryChannel(
  channelId: string,
  input: DeliveryChannelInput
): DeliveryChannel {
  validateDeliveryChannelInput(input);

  const store = readDeliveryStore();
  const existingChannel = store.channels.find(
    (channel) => channel.id === channelId
  );

  if (!existingChannel) {
    throw new Error(`Delivery channel ${channelId} not found.`);
  }

  const nextChannel: DeliveryChannel = {
    ...existingChannel,
    name: input.name.trim(),
    type: input.type,
    enabled: input.enabled,
    endpointUrl: input.endpointUrl.trim(),
    description: input.description,
    format: input.format,
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

  return nextChannel;
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
    throw new Error(`Delivery channel ${channelId} not found.`);
  }

  const nextChannel: DeliveryChannel = {
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

  return nextChannel;
}

export function buildDeliveryRequestPayload(
  digest: DailyDigest,
  channel: DeliveryChannel,
  deliveredAt = getTimestamp()
): { body: string; contentType: string; preview: string } {
  const adapter = getDeliveryAdapter(channel.type);

  if (!adapter) {
    throw new Error(
      "Delivery channel type is not implemented in this version."
    );
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
  channel: DeliveryChannel,
  message: string
): DeliveryRun {
  const store = readDeliveryStore();
  const nextChannel: DeliveryChannel = {
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
    throw new Error(`Digest ${digestDate} not found.`);
  }

  if (digest.status !== "published") {
    throw new Error("Only published digests can be previewed for delivery.");
  }

  if (!channel) {
    throw new Error(`Delivery channel ${channelId} not found.`);
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
  const channel = getDeliveryChannelById(channelId);

  if (!digest) {
    throw new Error(`Digest ${digestDate} not found.`);
  }

  if (digest.status !== "published") {
    throw new Error("Only published digests can be delivered.");
  }

  if (!channel) {
    throw new Error(`Delivery channel ${channelId} not found.`);
  }

  if (!channel.enabled) {
    throw new Error("Delivery channel is disabled.");
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
      errorMessage: "Delivery channel type is not implemented in this version."
    };

    persistDeliveryRun(
      run,
      channel,
      "Delivery channel type is not implemented in this version."
    );

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
    const responseText = truncate(response.bodyPreview, 1000);
    const finishedAt = getTimestamp();
    const channelLabel =
      channel.type === "feishu_webhook" ? "Feishu webhook" : "Webhook";

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

      persistDeliveryRun(run, channel, run.errorMessage ?? "Delivery failed.");

      return run;
    }

    const run: DeliveryRun = {
      ...pendingRun,
      status: "success",
      finishedAt,
      responseStatus: response.status,
      responseBodyPreview: responseText
    };

    return persistDeliveryRun(run, channel, "Delivery succeeded.");
  } catch (error) {
    const finishedAt = getTimestamp();
    const errorMessage =
      error instanceof Error ? error.message : "Unknown delivery error.";
    const run: DeliveryRun = {
      ...pendingRun,
      status: "failed",
      finishedAt,
      errorMessage
    };

    persistDeliveryRun(run, channel, errorMessage);

    return run;
  }
}

export async function retryDeliveryRun(runId: string): Promise<DeliveryRun> {
  const existingRun = getDeliveryRuns().find((run) => run.id === runId);

  if (!existingRun) {
    throw new Error(`Delivery run ${runId} not found.`);
  }

  return sendDailyDigestToChannel({
    digestDate: existingRun.digestDate,
    channelId: existingRun.channelId,
    retryOfDeliveryRunId: existingRun.id
  });
}
