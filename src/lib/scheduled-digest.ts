import {
  createDailyScheduleConfigStore,
  isDailyScheduleDue,
  type DailyScheduleConfig,
  type DailyScheduleUpdate
} from "@/lib/daily-schedule-config";
import {
  getDailyDigestByDate,
  generateDailyDigest
} from "@/lib/digest-workflow";
import { getTodayDateString } from "@/lib/digest-store";

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

export type ScheduledDigestConfig =
  DailyScheduleConfig<ScheduledDigestRunStatus>;

export type ScheduledDigestUpdate = DailyScheduleUpdate;

const store = createDailyScheduleConfigStore<ScheduledDigestRunStatus>(
  "scheduled-digest.json",
  ["success", "failed"]
);

export function getScheduledDigestConfig(): ScheduledDigestConfig {
  return store.get();
}

export function updateScheduledDigestConfig(
  update: ScheduledDigestUpdate
): ScheduledDigestConfig {
  return store.update(update);
}

export const isScheduledDigestDue = isDailyScheduleDue;

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
  return {
    status,
    message,
    config: store.recordRun(
      config,
      { status: status === "failed" ? "failed" : "success", message },
      now
    )
  };
}
