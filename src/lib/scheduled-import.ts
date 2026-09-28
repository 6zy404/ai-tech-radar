import {
  createDailyScheduleConfigStore,
  isDailyScheduleDue,
  type DailyScheduleConfig,
  type DailyScheduleUpdate
} from "@/lib/daily-schedule-config";
import { runBatchImportForEnabledSources } from "@/lib/source-workflow";
import type { ImportRun } from "@/types/content";

/**
 * 定时导入 v0：task runner 在跑到期投递计划的同时，检查这份配置并在到期时
 * 执行一次「导入所有已启用来源」。这是快讯层保持每日新鲜的自动化入口。
 *
 * 与 ScheduledDelivery 相同的时间模型（`daily-schedule-config.ts`）：nextRunAt 为空视为立即到期；每次运行
 * 后把 nextRunAt 推进到下一个计划时间点，天然防止同日重复导入。
 */

export type ScheduledImportRunStatus =
  "never_run" | "success" | "failed" | "partial";

export type ScheduledImportConfig =
  DailyScheduleConfig<ScheduledImportRunStatus>;

export type ScheduledImportUpdate = DailyScheduleUpdate;

const store = createDailyScheduleConfigStore<ScheduledImportRunStatus>(
  "scheduled-import.json",
  ["success", "failed", "partial"]
);

export function getScheduledImportConfig(): ScheduledImportConfig {
  return store.get();
}

export function updateScheduledImportConfig(
  update: ScheduledImportUpdate
): ScheduledImportConfig {
  return store.update(update);
}

export const isScheduledImportDue = isDailyScheduleDue;

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

  return {
    run,
    config: store.recordRun(
      config,
      { status: run.status, message: buildScheduledImportMessage(run) },
      now
    )
  };
}
