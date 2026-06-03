import { randomUUID } from "node:crypto";

import {
  getDeliveryChannelById,
  getDeliveryRuns,
  sendDailyDigestToChannel
} from "@/lib/delivery-workflow";
import {
  getDailyDigestByDate,
  getLatestPublishedDailyDigest
} from "@/lib/digest-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  DailyDigest,
  ScheduledDelivery,
  ScheduledDeliveryDigestTarget,
  ScheduledDeliveryRun,
  ScheduledDeliveryRunStatus,
  ScheduledDeliveryTriggerType
} from "@/types/content";

interface ScheduledDeliveryStore {
  updatedAt: string;
  schedules: ScheduledDelivery[];
  runs: ScheduledDeliveryRun[];
}

export interface ScheduledDeliveryInput {
  name: string;
  enabled: boolean;
  digestTarget: ScheduledDeliveryDigestTarget;
  digestDate?: string;
  channelIds: string[];
  scheduleTime: string;
  timezone: string;
}

export class ScheduledDeliveryValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super("Scheduled delivery validation failed.");
    this.name = "ScheduledDeliveryValidationError";
    this.issues = issues;
  }
}

const scheduleStorePath = getLocalStoreFilePath("scheduled-delivery.json");
const defaultTimezone = "Asia/Shanghai";
const allowedDigestTargets: ScheduledDeliveryDigestTarget[] = [
  "latest_published_digest",
  "digest_by_date"
];
const allowedRunStatuses: ScheduledDeliveryRunStatus[] = [
  "never_run",
  "success",
  "failed",
  "partial"
];
const allowedTriggerTypes: ScheduledDeliveryTriggerType[] = [
  "scheduled",
  "manual",
  "retry"
];

function getTimestamp(date = new Date()): string {
  return date.toISOString();
}

function normalizeDigestTarget(value: unknown): ScheduledDeliveryDigestTarget {
  return allowedDigestTargets.includes(value as ScheduledDeliveryDigestTarget)
    ? (value as ScheduledDeliveryDigestTarget)
    : "latest_published_digest";
}

function normalizeRunStatus(value: unknown): ScheduledDeliveryRunStatus {
  return allowedRunStatuses.includes(value as ScheduledDeliveryRunStatus)
    ? (value as ScheduledDeliveryRunStatus)
    : "never_run";
}

function normalizeTriggerType(value: unknown): ScheduledDeliveryTriggerType {
  return allowedTriggerTypes.includes(value as ScheduledDeliveryTriggerType)
    ? (value as ScheduledDeliveryTriggerType)
    : "scheduled";
}

function normalizeChannelIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item).trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

function isValidDateString(value: string | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parseScheduleTime(value: string): { hour: number; minute: number } | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return undefined;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function getAsiaShanghaiDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function getRunDayKey(value: string, timezone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  if (timezone === defaultTimezone) {
    const parts = getAsiaShanghaiDateParts(date);

    return [
      parts.year.toString().padStart(4, "0"),
      parts.month.toString().padStart(2, "0"),
      parts.day.toString().padStart(2, "0")
    ].join("-");
  }

  return value.slice(0, 10);
}

export function computeNextRunAt(
  schedule: Pick<ScheduledDelivery, "scheduleTime" | "timezone">,
  now = new Date()
): string {
  const parsedTime = parseScheduleTime(schedule.scheduleTime);

  if (!parsedTime) {
    return getTimestamp(now);
  }

  if (schedule.timezone === defaultTimezone) {
    const parts = getAsiaShanghaiDateParts(now);
    let candidate = new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parsedTime.hour - 8,
        parsedTime.minute,
        0,
        0
      )
    );

    if (candidate.getTime() <= now.getTime()) {
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    }

    return candidate.toISOString();
  }

  const candidate = new Date(now);
  candidate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);

  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate.toISOString();
}

function normalizeSchedule(record: Record<string, unknown>): ScheduledDelivery {
  const now = getTimestamp();
  const scheduleTime =
    typeof record.scheduleTime === "string" && parseScheduleTime(record.scheduleTime)
      ? record.scheduleTime
      : "09:00";
  const timezone =
    typeof record.timezone === "string" && record.timezone.trim()
      ? record.timezone.trim()
      : defaultTimezone;
  const schedule: ScheduledDelivery = {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id
        : `delivery-schedule-${randomUUID()}`,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : "Untitled schedule",
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    digestTarget: normalizeDigestTarget(record.digestTarget),
    digestDate:
      typeof record.digestDate === "string" && record.digestDate.trim()
        ? record.digestDate.trim()
        : undefined,
    channelIds: normalizeChannelIds(record.channelIds),
    scheduleTime,
    timezone,
    lastRunAt:
      typeof record.lastRunAt === "string" ? record.lastRunAt : undefined,
    nextRunAt:
      typeof record.nextRunAt === "string"
        ? record.nextRunAt
        : computeNextRunAt({ scheduleTime, timezone }),
    lastRunStatus: normalizeRunStatus(record.lastRunStatus),
    lastRunMessage:
      typeof record.lastRunMessage === "string"
        ? record.lastRunMessage
        : undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now
  };

  return schedule;
}

function normalizeScheduleRun(record: Record<string, unknown>): ScheduledDeliveryRun {
  const now = getTimestamp();

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id
        : `scheduled-delivery-run-${randomUUID()}`,
    scheduleId: typeof record.scheduleId === "string" ? record.scheduleId : "",
    scheduleName: typeof record.scheduleName === "string" ? record.scheduleName : "",
    digestId: typeof record.digestId === "string" ? record.digestId : undefined,
    digestDate:
      typeof record.digestDate === "string" ? record.digestDate : undefined,
    startedAt: typeof record.startedAt === "string" ? record.startedAt : now,
    finishedAt:
      typeof record.finishedAt === "string" ? record.finishedAt : undefined,
    status: normalizeRunStatus(record.status),
    totalChannels:
      typeof record.totalChannels === "number" ? record.totalChannels : 0,
    successfulChannels:
      typeof record.successfulChannels === "number"
        ? record.successfulChannels
        : 0,
    failedChannels:
      typeof record.failedChannels === "number" ? record.failedChannels : 0,
    skippedChannels:
      typeof record.skippedChannels === "number" ? record.skippedChannels : 0,
    deliveryLogIds: normalizeChannelIds(record.deliveryLogIds),
    triggerType: normalizeTriggerType(record.triggerType),
    message: typeof record.message === "string" ? record.message : ""
  };
}

function getDefaultScheduleStore(): ScheduledDeliveryStore {
  return {
    updatedAt: getTimestamp(),
    schedules: [],
    runs: []
  };
}

function readScheduleStore(): ScheduledDeliveryStore {
  const store = readJsonFile<ScheduledDeliveryStore>(
    scheduleStorePath,
    getDefaultScheduleStore()
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    schedules: (store.schedules ?? []).map((schedule) =>
      normalizeSchedule(schedule as unknown as Record<string, unknown>)
    ),
    runs: (store.runs ?? [])
      .map((run) => normalizeScheduleRun(run as unknown as Record<string, unknown>))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  };
}

function writeScheduleStore(store: ScheduledDeliveryStore) {
  writeJsonFile(scheduleStorePath, {
    updatedAt: getTimestamp(),
    schedules: store.schedules.sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    runs: store.runs.sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    )
  });
}

function validateScheduledDeliveryInput(input: ScheduledDeliveryInput) {
  const issues: string[] = [];

  if (!input.name.trim()) {
    issues.push("Schedule name is required.");
  }

  if (!allowedDigestTargets.includes(input.digestTarget)) {
    issues.push("Digest target is not supported.");
  }

  if (input.digestTarget === "digest_by_date" && !isValidDateString(input.digestDate)) {
    issues.push("Digest date is required for digest_by_date schedules.");
  }

  if (!parseScheduleTime(input.scheduleTime)) {
    issues.push("Schedule time must use HH:mm format.");
  }

  if (!input.timezone.trim()) {
    issues.push("Timezone is required.");
  }

  if (input.channelIds.length === 0) {
    issues.push("At least one delivery channel is required.");
  }

  if (issues.length > 0) {
    throw new ScheduledDeliveryValidationError(issues);
  }
}

export function coerceScheduledDeliveryInput(
  record: Record<string, unknown>
): ScheduledDeliveryInput {
  return {
    name: String(record.name ?? "").trim(),
    enabled: record.enabled === true || record.enabled === "on",
    digestTarget: normalizeDigestTarget(record.digestTarget),
    digestDate: String(record.digestDate ?? "").trim() || undefined,
    channelIds: normalizeChannelIds(record.channelIds),
    scheduleTime: String(record.scheduleTime ?? "09:00").trim(),
    timezone: String(record.timezone ?? defaultTimezone).trim() || defaultTimezone
  };
}

export function getScheduledDeliveries(): ScheduledDelivery[] {
  return readScheduleStore().schedules;
}

export function getScheduledDeliveryById(
  scheduleId: string
): ScheduledDelivery | undefined {
  return getScheduledDeliveries().find((schedule) => schedule.id === scheduleId);
}

export function getScheduledDeliveryRuns(): ScheduledDeliveryRun[] {
  return readScheduleStore().runs;
}

export function getScheduledDeliveryRunsForSchedule(
  scheduleId: string
): ScheduledDeliveryRun[] {
  return getScheduledDeliveryRuns().filter((run) => run.scheduleId === scheduleId);
}

export function getDueScheduledDeliveries(now = new Date()): ScheduledDelivery[] {
  return getScheduledDeliveries().filter((schedule) => {
    if (!schedule.enabled) {
      return false;
    }

    if (!schedule.nextRunAt) {
      return true;
    }

    const nextRunAt = new Date(schedule.nextRunAt);

    return !Number.isNaN(nextRunAt.getTime()) && nextRunAt.getTime() <= now.getTime();
  });
}

export function createScheduledDelivery(
  input: ScheduledDeliveryInput
): ScheduledDelivery {
  validateScheduledDeliveryInput(input);

  const store = readScheduleStore();
  const now = getTimestamp();
  const schedule: ScheduledDelivery = {
    id: `delivery-schedule-${randomUUID()}`,
    name: input.name.trim(),
    enabled: input.enabled,
    digestTarget: input.digestTarget,
    digestDate: input.digestDate,
    channelIds: Array.from(new Set(input.channelIds)),
    scheduleTime: input.scheduleTime,
    timezone: input.timezone,
    nextRunAt: computeNextRunAt(input),
    lastRunStatus: "never_run",
    createdAt: now,
    updatedAt: now
  };

  writeScheduleStore({
    updatedAt: now,
    schedules: [...store.schedules, schedule],
    runs: store.runs
  });

  return schedule;
}

export function updateScheduledDelivery(
  scheduleId: string,
  input: ScheduledDeliveryInput
): ScheduledDelivery {
  validateScheduledDeliveryInput(input);

  const store = readScheduleStore();
  const existingSchedule = store.schedules.find(
    (schedule) => schedule.id === scheduleId
  );

  if (!existingSchedule) {
    throw new Error(`Scheduled delivery ${scheduleId} not found.`);
  }

  const nextSchedule: ScheduledDelivery = {
    ...existingSchedule,
    name: input.name.trim(),
    enabled: input.enabled,
    digestTarget: input.digestTarget,
    digestDate: input.digestDate,
    channelIds: Array.from(new Set(input.channelIds)),
    scheduleTime: input.scheduleTime,
    timezone: input.timezone,
    nextRunAt: computeNextRunAt(input),
    updatedAt: getTimestamp()
  };

  writeScheduleStore({
    updatedAt: getTimestamp(),
    schedules: [
      ...store.schedules.filter((schedule) => schedule.id !== scheduleId),
      nextSchedule
    ],
    runs: store.runs
  });

  return nextSchedule;
}

export function setScheduledDeliveryEnabled(
  scheduleId: string,
  enabled: boolean
): ScheduledDelivery {
  const store = readScheduleStore();
  const existingSchedule = store.schedules.find(
    (schedule) => schedule.id === scheduleId
  );

  if (!existingSchedule) {
    throw new Error(`Scheduled delivery ${scheduleId} not found.`);
  }

  const nextSchedule: ScheduledDelivery = {
    ...existingSchedule,
    enabled,
    updatedAt: getTimestamp()
  };

  writeScheduleStore({
    updatedAt: getTimestamp(),
    schedules: [
      ...store.schedules.filter((schedule) => schedule.id !== scheduleId),
      nextSchedule
    ],
    runs: store.runs
  });

  return nextSchedule;
}

function resolveDigestForSchedule(schedule: ScheduledDelivery): DailyDigest | undefined {
  if (schedule.digestTarget === "digest_by_date") {
    return schedule.digestDate
      ? getDailyDigestByDate(schedule.digestDate)
      : undefined;
  }

  return getLatestPublishedDailyDigest();
}

function getPreviouslySentScheduledChannelIds(
  schedule: ScheduledDelivery,
  digest: DailyDigest,
  runDate: Date
): Set<string> {
  const store = readScheduleStore();
  const deliveryRunById = new Map(
    getDeliveryRuns().map((deliveryRun) => [deliveryRun.id, deliveryRun])
  );
  const runDayKey = getRunDayKey(runDate.toISOString(), schedule.timezone);
  const channelIds = new Set<string>();

  for (const run of store.runs) {
    if (
      run.scheduleId !== schedule.id ||
      run.digestId !== digest.id ||
      run.digestDate !== digest.date ||
      run.triggerType !== "scheduled" ||
      getRunDayKey(run.startedAt, schedule.timezone) !== runDayKey
    ) {
      continue;
    }

    for (const deliveryLogId of run.deliveryLogIds) {
      const deliveryRun = deliveryRunById.get(deliveryLogId);

      if (deliveryRun) {
        channelIds.add(deliveryRun.channelId);
      }
    }
  }

  return channelIds;
}

function getRunStatus({
  successfulChannels,
  failedChannels,
  skippedChannels,
  totalChannels
}: {
  successfulChannels: number;
  failedChannels: number;
  skippedChannels: number;
  totalChannels: number;
}): ScheduledDeliveryRunStatus {
  if (failedChannels > 0 && successfulChannels > 0) {
    return "partial";
  }

  if (failedChannels > 0) {
    return "failed";
  }

  if (successfulChannels > 0 && skippedChannels > 0) {
    return "partial";
  }

  if (successfulChannels > 0) {
    return "success";
  }

  return totalChannels > 0 && skippedChannels > 0 ? "partial" : "failed";
}

function persistScheduledDeliveryRun(
  schedule: ScheduledDelivery,
  run: ScheduledDeliveryRun
): ScheduledDeliveryRun {
  const store = readScheduleStore();
  const nextSchedule: ScheduledDelivery = {
    ...schedule,
    lastRunAt: run.finishedAt,
    nextRunAt: computeNextRunAt(schedule, new Date(run.finishedAt ?? run.startedAt)),
    lastRunStatus: run.status,
    lastRunMessage: run.message,
    updatedAt: getTimestamp()
  };

  writeScheduleStore({
    updatedAt: getTimestamp(),
    schedules: [
      ...store.schedules.filter((item) => item.id !== schedule.id),
      nextSchedule
    ],
    runs: [run, ...store.runs.filter((item) => item.id !== run.id)]
  });

  tryRecordWorkflowEvent({
    entityType: "scheduled_delivery",
    entityId: schedule.id,
    action: run.status === "failed" ? "schedule.run_failed" : "schedule.run",
    actorType: run.triggerType === "scheduled" ? "task_runner" : "workspace_user",
    beforeSnapshot: schedule,
    afterSnapshot: nextSchedule,
    metadata: {
      runId: run.id,
      digestId: run.digestId,
      digestDate: run.digestDate,
      status: run.status,
      triggerType: run.triggerType,
      totalChannels: run.totalChannels,
      successfulChannels: run.successfulChannels,
      failedChannels: run.failedChannels,
      skippedChannels: run.skippedChannels,
      deliveryLogIds: run.deliveryLogIds
    }
  });

  return run;
}

export async function runScheduleById(
  scheduleId: string,
  options: {
    triggerType?: ScheduledDeliveryTriggerType;
    force?: boolean;
    now?: Date;
  } = {}
): Promise<ScheduledDeliveryRun> {
  const schedule = getScheduledDeliveryById(scheduleId);

  if (!schedule) {
    throw new Error(`Scheduled delivery ${scheduleId} not found.`);
  }

  if (!schedule.enabled) {
    throw new Error("Scheduled delivery is disabled.");
  }

  const triggerType = options.triggerType ?? "manual";
  const force = options.force ?? triggerType !== "scheduled";
  const startedAt = getTimestamp(options.now ?? new Date());
  const digest = resolveDigestForSchedule(schedule);
  const uniqueChannelIds = Array.from(new Set(schedule.channelIds));
  const baseRun = {
    id: `scheduled-delivery-run-${randomUUID()}`,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    startedAt,
    totalChannels: uniqueChannelIds.length,
    successfulChannels: 0,
    failedChannels: 0,
    skippedChannels: 0,
    deliveryLogIds: [],
    triggerType
  };

  if (!digest) {
    const finishedAt = getTimestamp();
    const run: ScheduledDeliveryRun = {
      ...baseRun,
      finishedAt,
      status: "failed",
      message: "No digest matched the schedule target."
    };

    return persistScheduledDeliveryRun(schedule, run);
  }

  if (digest.status !== "published") {
    const finishedAt = getTimestamp();
    const run: ScheduledDeliveryRun = {
      ...baseRun,
      digestId: digest.id,
      digestDate: digest.date,
      finishedAt,
      status: "failed",
      message: "Scheduled delivery can only send published digests."
    };

    return persistScheduledDeliveryRun(schedule, run);
  }

  const previouslySentChannelIds =
    !force && triggerType === "scheduled"
      ? getPreviouslySentScheduledChannelIds(schedule, digest, new Date(startedAt))
      : new Set<string>();
  let successfulChannels = 0;
  let failedChannels = 0;
  let skippedChannels = 0;
  const deliveryLogIds: string[] = [];

  for (const channelId of uniqueChannelIds) {
    const channel = getDeliveryChannelById(channelId);

    if (!channel || !channel.enabled || previouslySentChannelIds.has(channelId)) {
      skippedChannels += 1;
      continue;
    }

    const deliveryRun = await sendDailyDigestToChannel({
      digestDate: digest.date,
      channelId
    });

    deliveryLogIds.push(deliveryRun.id);

    if (deliveryRun.status === "success") {
      successfulChannels += 1;
    } else {
      failedChannels += 1;
    }
  }

  const finishedAt = getTimestamp();
  const status = getRunStatus({
    successfulChannels,
    failedChannels,
    skippedChannels,
    totalChannels: uniqueChannelIds.length
  });
  const message = [
    `${successfulChannels} succeeded`,
    `${failedChannels} failed`,
    `${skippedChannels} skipped`
  ].join(", ");
  const run: ScheduledDeliveryRun = {
    ...baseRun,
    digestId: digest.id,
    digestDate: digest.date,
    finishedAt,
    status,
    successfulChannels,
    failedChannels,
    skippedChannels,
    deliveryLogIds,
    message
  };

  return persistScheduledDeliveryRun(schedule, run);
}

export async function runDueSchedules(
  now = new Date()
): Promise<ScheduledDeliveryRun[]> {
  const schedules = getDueScheduledDeliveries(now);
  const runs: ScheduledDeliveryRun[] = [];

  for (const schedule of schedules) {
    runs.push(
      await runScheduleById(schedule.id, {
        triggerType: "scheduled",
        force: false,
        now
      })
    );
  }

  return runs;
}
