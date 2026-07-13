import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { computeNextRunAt } from "@/lib/scheduled-delivery-workflow";
import { runBatchImportForEnabledSources } from "@/lib/source-workflow";
import type { ImportRun } from "@/types/content";

/**
 * 定时导入 v0：task runner 在跑到期投递计划的同时，检查这份配置并在到期时
 * 执行一次「导入所有已启用来源」。这是快讯层保持每日新鲜的自动化入口。
 *
 * 与 ScheduledDelivery 相同的时间模型：nextRunAt 为空视为立即到期；每次运行
 * 后把 nextRunAt 推进到下一个计划时间点，天然防止同日重复导入。
 */
export type ScheduledImportRunStatus =
  "never_run" | "success" | "failed" | "partial";

export interface ScheduledImportConfig {
  enabled: boolean;
  scheduleTime: string;
  timezone: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus: ScheduledImportRunStatus;
  lastRunMessage?: string;
  updatedAt: string;
}

export interface ScheduledImportUpdate {
  enabled?: boolean;
  scheduleTime?: string;
}

const scheduledImportStorePath = getLocalStoreFilePath("scheduled-import.json");
const defaultScheduleTime = "08:00";
const defaultTimezone = "Asia/Shanghai";
const scheduleTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getTimestamp(date = new Date()): string {
  return date.toISOString();
}

function getDefaultScheduledImportConfig(): ScheduledImportConfig {
  return {
    enabled: true,
    scheduleTime: defaultScheduleTime,
    timezone: defaultTimezone,
    lastRunStatus: "never_run",
    updatedAt: getTimestamp()
  };
}

function normalizeRunStatus(value: unknown): ScheduledImportRunStatus {
  return value === "success" || value === "failed" || value === "partial"
    ? value
    : "never_run";
}

function normalizeScheduledImportConfig(
  record: Record<string, unknown>
): ScheduledImportConfig {
  const defaults = getDefaultScheduledImportConfig();

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    scheduleTime:
      typeof record.scheduleTime === "string" &&
      scheduleTimePattern.test(record.scheduleTime)
        ? record.scheduleTime
        : defaults.scheduleTime,
    timezone:
      typeof record.timezone === "string" && record.timezone.trim()
        ? record.timezone
        : defaults.timezone,
    nextRunAt:
      typeof record.nextRunAt === "string" ? record.nextRunAt : undefined,
    lastRunAt:
      typeof record.lastRunAt === "string" ? record.lastRunAt : undefined,
    lastRunStatus: normalizeRunStatus(record.lastRunStatus),
    lastRunMessage:
      typeof record.lastRunMessage === "string"
        ? record.lastRunMessage
        : undefined,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : defaults.updatedAt
  };
}

export function getScheduledImportConfig(): ScheduledImportConfig {
  const record = readJsonFile<Record<string, unknown>>(
    scheduledImportStorePath,
    getDefaultScheduledImportConfig() as unknown as Record<string, unknown>
  );

  return normalizeScheduledImportConfig(record);
}

function writeScheduledImportConfig(config: ScheduledImportConfig) {
  writeJsonFile(scheduledImportStorePath, {
    ...config,
    updatedAt: getTimestamp()
  });
}

export function updateScheduledImportConfig(
  update: ScheduledImportUpdate
): ScheduledImportConfig {
  const config = getScheduledImportConfig();

  if (
    update.scheduleTime !== undefined &&
    !scheduleTimePattern.test(update.scheduleTime)
  ) {
    throw new Error("计划时间必须是 HH:mm 格式，例如 08:00。");
  }

  const next: ScheduledImportConfig = {
    ...config,
    enabled: update.enabled ?? config.enabled,
    scheduleTime: update.scheduleTime ?? config.scheduleTime
  };

  if (
    update.scheduleTime !== undefined &&
    update.scheduleTime !== config.scheduleTime
  ) {
    next.nextRunAt = computeNextRunAt({
      scheduleTime: next.scheduleTime,
      timezone: next.timezone
    });
  }

  writeScheduledImportConfig(next);

  return getScheduledImportConfig();
}

export function isScheduledImportDue(
  config: ScheduledImportConfig,
  now = new Date()
): boolean {
  if (!config.enabled) {
    return false;
  }

  if (!config.nextRunAt) {
    return true;
  }

  const nextRunAt = new Date(config.nextRunAt);

  return (
    !Number.isNaN(nextRunAt.getTime()) && nextRunAt.getTime() <= now.getTime()
  );
}

const importRunStatusLabels: Record<ImportRun["status"], string> = {
  success: "成功",
  failed: "失败",
  partial: "部分成功"
};

export function buildScheduledImportMessage(run: ImportRun): string {
  return (
    `定时导入${importRunStatusLabels[run.status]}：` +
    `${run.enabledSources} 个启用来源（成功 ${run.successfulSources}，` +
    `失败 ${run.failedSources}，部分 ${run.partialSources}），` +
    `新增候选 ${run.totalCandidatesCreated} 条，跳过 ${run.totalCandidatesSkipped} 条。`
  );
}

export async function runScheduledImport({
  now = new Date()
}: { now?: Date } = {}): Promise<{
  run: ImportRun;
  config: ScheduledImportConfig;
}> {
  const config = getScheduledImportConfig();

  // 无人值守运行不生成回退占位候选：来源失败只记录健康状态，
  // 避免占位数据每日堆积在候选池里。
  const { run } = await runBatchImportForEnabledSources({
    useFallbackOnFailure: false
  });

  const next: ScheduledImportConfig = {
    ...config,
    lastRunAt: getTimestamp(now),
    lastRunStatus: run.status,
    lastRunMessage: buildScheduledImportMessage(run),
    nextRunAt: computeNextRunAt(
      { scheduleTime: config.scheduleTime, timezone: config.timezone },
      now
    )
  };

  writeScheduledImportConfig(next);

  return { run, config: getScheduledImportConfig() };
}
