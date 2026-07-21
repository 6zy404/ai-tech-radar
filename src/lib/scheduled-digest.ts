import {
  getDailyDigestByDate,
  generateDailyDigest
} from "@/lib/digest-workflow";
import { getTodayDateString } from "@/lib/digest-store";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { computeNextRunAt } from "@/lib/scheduled-delivery-workflow";

/**
 * 定时简报草稿 v0：task runner 在跑到期投递计划（以及定时导入）的同时，检查
 * 这份配置并在到期时为当天生成一份简报草稿。发布始终由编辑把关——这里只生成
 * `status = draft` 的草稿，绝不自动发布；当天已存在简报（无论状态）时直接跳
 * 过，不触碰编辑可能正在调整的内容。
 *
 * 与 ScheduledImport 相同的时间模型：nextRunAt 为空视为立即到期；每次运行后
 * 把 nextRunAt 推进到下一个计划时间点，天然防止同日重复生成。
 *
 * 默认时间与定时导入相同（08:00）：生成晚于导入不是靠时钟错开，而是靠同一次
 * runner 传递里的代码顺序（先导入、后生成简报）保证——若把这里的时间设得晚于
 * 每日唯一一次 runner 触发时刻（如 Windows 计划任务的 08:05），会退化成隔天
 * 才生成一次。
 */
export type ScheduledDigestRunStatus = "never_run" | "success" | "failed";

export interface ScheduledDigestConfig {
  enabled: boolean;
  scheduleTime: string;
  timezone: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus: ScheduledDigestRunStatus;
  lastRunMessage?: string;
  updatedAt: string;
}

export interface ScheduledDigestUpdate {
  enabled?: boolean;
  scheduleTime?: string;
}

const scheduledDigestStorePath = getLocalStoreFilePath("scheduled-digest.json");
const defaultScheduleTime = "08:00";
const defaultTimezone = "Asia/Shanghai";
const scheduleTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getTimestamp(date = new Date()): string {
  return date.toISOString();
}

function getDefaultScheduledDigestConfig(): ScheduledDigestConfig {
  return {
    enabled: true,
    scheduleTime: defaultScheduleTime,
    timezone: defaultTimezone,
    lastRunStatus: "never_run",
    updatedAt: getTimestamp()
  };
}

function normalizeRunStatus(value: unknown): ScheduledDigestRunStatus {
  return value === "success" || value === "failed" ? value : "never_run";
}

function normalizeScheduledDigestConfig(
  record: Record<string, unknown>
): ScheduledDigestConfig {
  const defaults = getDefaultScheduledDigestConfig();

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

export function getScheduledDigestConfig(): ScheduledDigestConfig {
  const record = readJsonFile<Record<string, unknown>>(
    scheduledDigestStorePath,
    getDefaultScheduledDigestConfig() as unknown as Record<string, unknown>
  );

  return normalizeScheduledDigestConfig(record);
}

function writeScheduledDigestConfig(config: ScheduledDigestConfig) {
  writeJsonFile(scheduledDigestStorePath, {
    ...config,
    updatedAt: getTimestamp()
  });
}

export function updateScheduledDigestConfig(
  update: ScheduledDigestUpdate
): ScheduledDigestConfig {
  const config = getScheduledDigestConfig();

  if (
    update.scheduleTime !== undefined &&
    !scheduleTimePattern.test(update.scheduleTime)
  ) {
    throw new Error("计划时间必须是 HH:mm 格式，例如 08:00。");
  }

  const next: ScheduledDigestConfig = {
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

  writeScheduledDigestConfig(next);

  return getScheduledDigestConfig();
}

export function isScheduledDigestDue(
  config: ScheduledDigestConfig,
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

export interface ScheduledDigestRunResult {
  status: "generated" | "skipped" | "failed";
  message: string;
  config: ScheduledDigestConfig;
}

export function runScheduledDigest({
  now = new Date()
}: { now?: Date } = {}): ScheduledDigestRunResult {
  const config = getScheduledDigestConfig();
  const date = getTodayDateString();
  let status: ScheduledDigestRunResult["status"];
  let message: string;

  if (getDailyDigestByDate(date)) {
    // 当天已有简报（草稿或已发布）：跳过，不触碰编辑内容。
    status = "skipped";
    message = `定时简报草稿：今日（${date}）已存在简报，跳过生成。`;
  } else {
    try {
      const digest = generateDailyDigest(date);

      status = "generated";
      message =
        `定时简报草稿已生成：${date}，` +
        `立即关注 ${digest.highPriorityTechnologyIds.length} 条，` +
        `值得跟踪 ${digest.watchTechnologyIds.length} 条（待编辑审阅后发布）。`;
    } catch (error) {
      status = "failed";
      message = `定时简报草稿生成失败：${
        error instanceof Error ? error.message : "未知生成错误。"
      }`;
    }
  }

  // 无论结果如何都推进 nextRunAt：失败也等到下一个计划时间再试，
  // 避免 watch 模式下每分钟重复失败。
  const next: ScheduledDigestConfig = {
    ...config,
    lastRunAt: getTimestamp(now),
    lastRunStatus: status === "failed" ? "failed" : "success",
    lastRunMessage: message,
    nextRunAt: computeNextRunAt(
      { scheduleTime: config.scheduleTime, timezone: config.timezone },
      now
    )
  };

  writeScheduledDigestConfig(next);

  return { status, message, config: getScheduledDigestConfig() };
}
