import { randomUUID } from "node:crypto";

import {
  getDueScheduledDeliveries,
  getScheduledDeliveries,
  runScheduleById
} from "@/lib/scheduled-delivery-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  ScheduledDeliveryRun,
  TaskRunnerMode,
  TaskRunnerRun,
  TaskRunnerStatus
} from "@/types/content";

interface TaskRunnerStore {
  updatedAt: string;
  runs: TaskRunnerRun[];
}

export interface TaskRunnerOptions {
  mode?: TaskRunnerMode;
  now?: Date;
  logger?: (message: string) => void;
}

export interface TaskRunnerWatchOptions {
  intervalMs?: number;
  maxIterations?: number;
  logger?: (message: string) => void;
  nowProvider?: () => Date;
  signal?: AbortSignal;
}

const taskRunnerStorePath = getLocalStoreFilePath("task-runner.json");
const defaultWatchIntervalMs = 60_000;
const maxStoredRuns = 80;

function getTimestamp(date = new Date()): string {
  return date.toISOString();
}

function sanitizeRunnerMessage(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/(token|key|secret|signature|auth)=([^&\s]+)/gi, "$1=***")
    .replace(/(mock:\/\/(?:success|failed))\S*/gi, "$1");
}

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeTaskRunnerStatus(value: unknown): TaskRunnerStatus {
  return value === "success" || value === "failed" || value === "partial"
    ? value
    : "failed";
}

function normalizeTaskRunnerMode(value: unknown): TaskRunnerMode {
  return value === "watch" ? "watch" : "run_once";
}

function normalizeTaskRunnerRun(
  record: Record<string, unknown>
): TaskRunnerRun {
  const now = getTimestamp();

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id
        : `task-runner-${randomUUID()}`,
    mode: normalizeTaskRunnerMode(record.mode),
    startedAt: typeof record.startedAt === "string" ? record.startedAt : now,
    finishedAt: typeof record.finishedAt === "string" ? record.finishedAt : now,
    status: normalizeTaskRunnerStatus(record.status),
    dueScheduleCount: normalizeNumber(record.dueScheduleCount),
    skippedScheduleCount: normalizeNumber(record.skippedScheduleCount),
    successCount: normalizeNumber(record.successCount),
    failedCount: normalizeNumber(record.failedCount),
    partialCount: normalizeNumber(record.partialCount),
    deliveryLogsCreated: normalizeNumber(record.deliveryLogsCreated),
    messages: Array.isArray(record.messages)
      ? record.messages.map((message) => sanitizeRunnerMessage(String(message)))
      : []
  };
}

function getDefaultTaskRunnerStore(): TaskRunnerStore {
  return {
    updatedAt: getTimestamp(),
    runs: []
  };
}

function readTaskRunnerStore(): TaskRunnerStore {
  const store = readJsonFile<TaskRunnerStore>(
    taskRunnerStorePath,
    getDefaultTaskRunnerStore()
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    runs: (store.runs ?? [])
      .map((run) =>
        normalizeTaskRunnerRun(run as unknown as Record<string, unknown>)
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  };
}

function writeTaskRunnerStore(store: TaskRunnerStore) {
  writeJsonFile(taskRunnerStorePath, {
    updatedAt: getTimestamp(),
    runs: store.runs
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, maxStoredRuns)
  });
}

function persistTaskRunnerRun(run: TaskRunnerRun): TaskRunnerRun {
  const store = readTaskRunnerStore();

  writeTaskRunnerStore({
    updatedAt: getTimestamp(),
    runs: [run, ...store.runs.filter((item) => item.id !== run.id)]
  });

  tryRecordWorkflowEvent({
    entityType: "task_runner",
    entityId: run.id,
    action: "task_runner.run",
    actorType: "task_runner",
    afterSnapshot: run,
    metadata: {
      mode: run.mode,
      status: run.status,
      dueScheduleCount: run.dueScheduleCount,
      deliveryLogsCreated: run.deliveryLogsCreated
    }
  });

  return run;
}

function getTaskRunnerStatus({
  dueScheduleCount,
  successCount,
  failedCount,
  partialCount
}: {
  dueScheduleCount: number;
  successCount: number;
  failedCount: number;
  partialCount: number;
}): TaskRunnerStatus {
  if (dueScheduleCount === 0) {
    return "success";
  }

  if (failedCount > 0 && successCount === 0 && partialCount === 0) {
    return "failed";
  }

  if (failedCount > 0 || partialCount > 0) {
    return "partial";
  }

  return "success";
}

function logTaskRunnerRun(
  run: TaskRunnerRun,
  logger: (message: string) => void
) {
  logger(
    [
      `startedAt=${run.startedAt}`,
      `mode=${run.mode}`,
      `dueScheduleCount=${run.dueScheduleCount}`,
      `skippedScheduleCount=${run.skippedScheduleCount}`
    ].join(" ")
  );

  if (run.dueScheduleCount === 0) {
    logger("No due schedules.");
  }

  logger(
    [
      `successCount=${run.successCount}`,
      `failedCount=${run.failedCount}`,
      `partialCount=${run.partialCount}`,
      `deliveryLogsCreated=${run.deliveryLogsCreated}`,
      `finishedAt=${run.finishedAt}`,
      `status=${run.status}`
    ].join(" ")
  );

  for (const message of run.messages) {
    logger(`message=${message}`);
  }
}

function getRunMessage(run: ScheduledDeliveryRun): string {
  const digestLabel = run.digestDate ? `digest ${run.digestDate}` : "no digest";

  return `${run.scheduleName}: ${run.status} for ${digestLabel}; ${run.message}`;
}

export function getTaskRunnerRuns(): TaskRunnerRun[] {
  return readTaskRunnerStore().runs;
}

export function getLatestTaskRunnerRun(): TaskRunnerRun | undefined {
  return getTaskRunnerRuns()[0];
}

export async function runScheduledDeliveryTask({
  mode = "run_once",
  now = new Date(),
  logger = console.log
}: TaskRunnerOptions = {}): Promise<TaskRunnerRun> {
  const startedAt = getTimestamp(now);
  const allSchedules = getScheduledDeliveries();
  const dueSchedules = getDueScheduledDeliveries(now);
  const messages: string[] = [];
  let successCount = 0;
  let failedCount = 0;
  let partialCount = 0;
  let deliveryLogsCreated = 0;

  for (const schedule of dueSchedules) {
    try {
      const run = await runScheduleById(schedule.id, {
        triggerType: "scheduled",
        force: false,
        now
      });

      if (run.status === "success") {
        successCount += 1;
      } else if (run.status === "partial") {
        partialCount += 1;
      } else {
        failedCount += 1;
      }

      deliveryLogsCreated += run.deliveryLogIds.length;
      messages.push(getRunMessage(run));
    } catch (error) {
      failedCount += 1;
      messages.push(
        `${schedule.name}: ${
          error instanceof Error ? error.message : "Unknown schedule error."
        }`
      );
    }
  }

  if (dueSchedules.length === 0) {
    messages.push("No due schedules.");
  }

  const finishedAt = getTimestamp();
  let run: TaskRunnerRun = {
    id: `task-runner-${randomUUID()}`,
    mode,
    startedAt,
    finishedAt,
    status: getTaskRunnerStatus({
      dueScheduleCount: dueSchedules.length,
      successCount,
      failedCount,
      partialCount
    }),
    dueScheduleCount: dueSchedules.length,
    skippedScheduleCount: Math.max(
      allSchedules.length - dueSchedules.length,
      0
    ),
    successCount,
    failedCount,
    partialCount,
    deliveryLogsCreated,
    messages: messages.map(sanitizeRunnerMessage)
  };

  try {
    persistTaskRunnerRun(run);
  } catch (error) {
    const persistenceMessage = sanitizeRunnerMessage(
      `Task runner audit write failed: ${
        error instanceof Error ? error.message : "unknown write error"
      }`
    );

    run = {
      ...run,
      status: run.status === "success" ? "partial" : run.status,
      messages: [...run.messages, persistenceMessage]
    };
  }

  logTaskRunnerRun(run, logger);

  return run;
}

function sleep(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (intervalMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, intervalMs);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export async function watchScheduledDeliveryTasks({
  intervalMs = defaultWatchIntervalMs,
  maxIterations,
  logger = console.log,
  nowProvider = () => new Date(),
  signal
}: TaskRunnerWatchOptions = {}): Promise<TaskRunnerRun[]> {
  const runs: TaskRunnerRun[] = [];
  let iteration = 0;

  logger(`Task runner watch mode started. intervalMs=${intervalMs}`);

  while (!signal?.aborted) {
    iteration += 1;

    try {
      runs.push(
        await runScheduledDeliveryTask({
          mode: "watch",
          now: nowProvider(),
          logger
        })
      );
    } catch (error) {
      logger(
        `watchIterationError=${
          error instanceof Error
            ? sanitizeRunnerMessage(error.message)
            : "unknown"
        }`
      );
    }

    if (maxIterations !== undefined && iteration >= maxIterations) {
      break;
    }

    await sleep(intervalMs, signal);
  }

  logger("Task runner watch mode stopped.");

  return runs;
}
