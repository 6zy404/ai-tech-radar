import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { computeNextRunAt } from "@/lib/scheduled-delivery-workflow";

/**
 * 每日一次的任务运行器配置（定时导入、定时简报草稿）共用的存储与时间模型。
 * 两者此前各自复制了这一整套：单对象 JSON、`HH:mm` 时间、nextRunAt 为空视为
 * 立即到期、每次运行后推进 nextRunAt。各自保留的只有「到期时做什么」。
 */
export interface DailyScheduleConfig<TRunStatus extends string> {
  enabled: boolean;
  scheduleTime: string;
  timezone: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus: TRunStatus;
  lastRunMessage?: string;
  updatedAt: string;
}

export interface DailyScheduleUpdate {
  enabled?: boolean;
  scheduleTime?: string;
}

const defaultScheduleTime = "08:00";
const defaultTimezone = "Asia/Shanghai";
const scheduleTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isDailyScheduleDue(
  config: { enabled: boolean; nextRunAt?: string },
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

/**
 * `runStatuses` lists every status a run can record; anything else read from
 * disk becomes "never_run".
 */
export function createDailyScheduleConfigStore<TRunStatus extends string>(
  fileName: string,
  runStatuses: readonly Exclude<TRunStatus, "never_run">[]
) {
  type Config = DailyScheduleConfig<TRunStatus | "never_run">;

  const storePath = getLocalStoreFilePath(fileName);

  function getDefaults(): Config {
    return {
      enabled: true,
      scheduleTime: defaultScheduleTime,
      timezone: defaultTimezone,
      lastRunStatus: "never_run",
      updatedAt: new Date().toISOString()
    };
  }

  function normalize(record: Record<string, unknown>): Config {
    const defaults = getDefaults();
    const status = record.lastRunStatus as Exclude<TRunStatus, "never_run">;

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
      nextRunAt: optionalString(record.nextRunAt),
      lastRunAt: optionalString(record.lastRunAt),
      lastRunStatus: runStatuses.includes(status) ? status : "never_run",
      lastRunMessage: optionalString(record.lastRunMessage),
      updatedAt: optionalString(record.updatedAt) ?? defaults.updatedAt
    };
  }

  function get(): Config {
    return normalize(
      readJsonFile<Record<string, unknown>>(
        storePath,
        getDefaults() as unknown as Record<string, unknown>
      )
    );
  }

  function write(config: Config) {
    writeJsonFile(storePath, {
      ...config,
      updatedAt: new Date().toISOString()
    });
  }

  function update(change: DailyScheduleUpdate): Config {
    const config = get();

    if (
      change.scheduleTime !== undefined &&
      !scheduleTimePattern.test(change.scheduleTime)
    ) {
      throw new Error("计划时间必须是 HH:mm 格式，例如 08:00。");
    }

    const next: Config = {
      ...config,
      enabled: change.enabled ?? config.enabled,
      scheduleTime: change.scheduleTime ?? config.scheduleTime
    };

    if (
      change.scheduleTime !== undefined &&
      change.scheduleTime !== config.scheduleTime
    ) {
      next.nextRunAt = computeNextRunAt({
        scheduleTime: next.scheduleTime,
        timezone: next.timezone
      });
    }

    write(next);

    return get();
  }

  // Records a finished run and moves nextRunAt to the next scheduled time,
  // which is also what keeps a schedule from running twice in one day.
  // Re-reads the config instead of taking the one the run started from: the
  // import awaits the network for about two minutes, and writing back that
  // copy undid an enabled / scheduleTime change saved meanwhile from the
  // workspace (another process).
  function recordRun(
    result: { status: Exclude<TRunStatus, "never_run">; message: string },
    now: Date
  ): Config {
    const config = get();

    write({
      ...config,
      lastRunAt: now.toISOString(),
      lastRunStatus: result.status,
      lastRunMessage: result.message,
      nextRunAt: computeNextRunAt(
        { scheduleTime: config.scheduleTime, timezone: config.timezone },
        now
      )
    });

    return get();
  }

  return { get, update, recordRun };
}
