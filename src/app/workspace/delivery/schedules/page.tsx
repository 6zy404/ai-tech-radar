import Link from "next/link";

import {
  RunDueSchedulesButton,
  ScheduledDeliveryActions
} from "@/components/scheduled-delivery-actions";
import { ScheduledDeliveryForm } from "@/components/scheduled-delivery-form";
import { ScheduledDigestActions } from "@/components/scheduled-digest-actions";
import { ScheduledImportActions } from "@/components/scheduled-import-actions";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { getDeliveryChannels } from "@/lib/delivery-workflow";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "@/lib/scheduled-delivery-workflow";
import { getScheduledDigestConfig } from "@/lib/scheduled-digest";
import { getScheduledImportConfig } from "@/lib/scheduled-import";
import { getLatestExternalSourceImportRun } from "@/lib/source-workflow";
import { getLatestTaskRunnerRun } from "@/lib/task-runner";
import { getRecentWorkflowEvents } from "@/lib/workflow-events";
import type { ScheduledDeliveryRunStatus } from "@/types/content";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

const runStatusLabels: Record<string, string> = {
  never_run: "未运行",
  success: "成功",
  failed: "失败",
  partial: "部分成功"
};

function getRunStatusLabel(
  status: ScheduledDeliveryRunStatus | undefined
): string {
  return status ? (runStatusLabels[status] ?? status) : "未运行";
}

function getRunStatusTone(status: ScheduledDeliveryRunStatus | undefined) {
  if (status === "success") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "partial") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getDigestTargetLabel(target: string, digestDate: string | undefined) {
  if (target === "digest_by_date") {
    return digestDate ? `${digestDate} 简报` : "指定日期简报";
  }

  return "最新已发布简报";
}

export default function WorkspaceDeliverySchedulesPage() {
  const channels = getDeliveryChannels();
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const schedules = getScheduledDeliveries();
  const runs = getScheduledDeliveryRuns();
  const latestTaskRunnerRun = getLatestTaskRunnerRun();
  const scheduledImportConfig = getScheduledImportConfig();
  const scheduledDigestConfig = getScheduledDigestConfig();
  const latestImportRun = getLatestExternalSourceImportRun();
  const now = Date.now();
  const enabledCount = schedules.filter((schedule) => schedule.enabled).length;
  const failedRunCount = runs.filter((run) => run.status === "failed").length;
  const recentScheduleEvents = getRecentWorkflowEvents({
    entityTypes: ["scheduled_delivery", "task_runner"],
    limit: 6
  });
  const dueCount = schedules.filter((schedule) => {
    if (!schedule.enabled) {
      return false;
    }

    if (!schedule.nextRunAt) {
      return true;
    }

    const nextRunAt = Date.parse(schedule.nextRunAt);

    return !Number.isNaN(nextRunAt) && nextRunAt <= now;
  }).length;
  const lastRun = runs[0];

  return (
    <WorkspacePageShell
      className="workspace-delivery-console workspace-schedule-console"
      title="定时投递"
      description="管理把已发布每日简报发送到已启用投递渠道的本地计划。"
      sectionLabel="投递 / 定时"
      actions={
        <a
          className="action-button action-button--accent"
          href="#create-schedule"
        >
          创建计划
        </a>
      }
      securityNote={
        <>
          <strong>内部工作台</strong> ·
          计划会触发投递渠道；每个数据目录只保留一个任务运行器。
        </>
      }
    >
      <section className="delivery-console-summary" aria-label="计划摘要">
        <article className="delivery-console-summary__card">
          <span>计划总数</span>
          <strong>{schedules.length}</strong>
          <p>{enabledCount} 个已启用</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>当前到期</span>
          <strong>{dueCount}</strong>
          <p>{schedules.length - enabledCount} 个已停用</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>最近运行</span>
          <strong>{getRunStatusLabel(lastRun?.status)}</strong>
          <p>{formatDateTime(lastRun?.finishedAt ?? lastRun?.startedAt)}</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>失败运行</span>
          <strong>{failedRunCount}</strong>
          <p>共 {runs.length} 条计划运行记录</p>
        </article>
      </section>

      <section
        id="delivery-schedules"
        className="detail-panel delivery-console-panel"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">投递计划</p>
            <h2>已配置计划</h2>
            <p>
              计划决定何时发送，渠道决定发送到哪里。停用的计划和停用的渠道会被跳过。
            </p>
          </div>
          <Link className="action-link" href="/workspace/delivery">
            管理渠道
          </Link>
        </div>

        <section
          id="create-schedule"
          className="delivery-create-panel schedule-create-panel"
          aria-label="创建投递计划"
        >
          <div className="delivery-create-panel__summary">
            <div>
              <h3>创建计划</h3>
              <p>
                选择一个简报目标、一个本地时间，以及一个或多个已启用渠道。表单在打开本区域前保持收起。
              </p>
            </div>
            <a className="action-link" href="#delivery-schedules">
              收起表单
            </a>
          </div>
          <div className="delivery-create-panel__body">
            <ScheduledDeliveryForm channels={channels} />
          </div>
        </section>

        {schedules.length > 0 ? (
          <div
            className="delivery-table-scroll"
            role="region"
            aria-label="定时投递表格"
          >
            <div className="schedule-table schedule-table--console">
              <div className="schedule-table__head">
                <span>名称</span>
                <span>目标</span>
                <span>时间</span>
                <span>渠道</span>
                <span>状态</span>
                <span>最近运行</span>
                <span>下次运行</span>
                <span>操作</span>
              </div>
              {schedules.map((schedule) => {
                const channelNames = schedule.channelIds.map((channelId) => {
                  const channel = channelById.get(channelId);

                  return channel ? channel.name : `${channelId}（缺失）`;
                });
                const disabledChannelCount = schedule.channelIds.filter(
                  (channelId) => {
                    const channel = channelById.get(channelId);

                    return Boolean(channel && !channel.enabled);
                  }
                ).length;
                const missingChannelCount = schedule.channelIds.filter(
                  (channelId) => !channelById.has(channelId)
                ).length;
                const channelSummary = [
                  `已选 ${schedule.channelIds.length} 个`,
                  disabledChannelCount
                    ? `${disabledChannelCount} 个已停用`
                    : null,
                  missingChannelCount ? `${missingChannelCount} 个缺失` : null
                ]
                  .filter(Boolean)
                  .join("，");

                return (
                  <article className="schedule-row" key={schedule.id}>
                    <div className="schedule-row__identity">
                      <strong>{schedule.name}</strong>
                      <p>{schedule.lastRunMessage ?? "暂无运行消息。"}</p>
                    </div>
                    <div className="schedule-cell" data-label="目标">
                      <span>
                        {getDigestTargetLabel(
                          schedule.digestTarget,
                          schedule.digestDate
                        )}
                      </span>
                    </div>
                    <div className="schedule-cell" data-label="时间">
                      <span>{schedule.scheduleTime}</span>
                      <small>{schedule.timezone}</small>
                    </div>
                    <div className="schedule-cell" data-label="渠道">
                      <span>{channelSummary || "无渠道"}</span>
                      <small>
                        {channelNames.length > 0
                          ? `${channelNames.slice(0, 2).join(", ")}${
                              channelNames.length > 2
                                ? ` +${channelNames.length - 2}`
                                : ""
                            }`
                          : "未选择"}
                      </small>
                    </div>
                    <div className="schedule-cell" data-label="状态">
                      <WorkspaceStatusBadge
                        label={schedule.enabled ? "已启用" : "已停用"}
                        tone={schedule.enabled ? "success" : "neutral"}
                      />
                    </div>
                    <div className="schedule-cell" data-label="最近运行">
                      <WorkspaceStatusBadge
                        label={getRunStatusLabel(schedule.lastRunStatus)}
                        tone={getRunStatusTone(schedule.lastRunStatus)}
                      />
                      <small>{formatDateTime(schedule.lastRunAt)}</small>
                    </div>
                    <div className="schedule-cell" data-label="下次运行">
                      <span>{formatDateTime(schedule.nextRunAt)}</span>
                    </div>
                    <div className="schedule-row__actions">
                      <ScheduledDeliveryActions
                        scheduleId={schedule.id}
                        enabled={schedule.enabled}
                      />
                      <details className="schedule-row__edit">
                        <summary>编辑</summary>
                        <ScheduledDeliveryForm
                          schedule={schedule}
                          channels={channels}
                        />
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="schedule-empty-state">
            <h3>还没有计划</h3>
            <p>
              先添加至少一个投递渠道，再创建计划。计划只会发送已发布的简报，并跳过停用的渠道。
            </p>
            <a className="action-link" href="#create-schedule">
              打开创建计划表单
            </a>
          </div>
        )}
      </section>

      <section className="detail-panel delivery-console-panel schedule-runs-panel">
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">计划运行</p>
            <h2>近期执行</h2>
            <p>每条运行记录汇总一次计划执行的各渠道投递日志。</p>
          </div>
        </div>

        {runs.length > 0 ? (
          <div
            className="delivery-table-scroll"
            role="region"
            aria-label="定时投递运行表格"
          >
            <div className="schedule-run-table">
              <div className="schedule-run-table__head">
                <span>时间</span>
                <span>计划</span>
                <span>简报</span>
                <span>状态</span>
                <span>渠道</span>
                <span>触发方式</span>
                <span>消息</span>
              </div>
              {runs.slice(0, 20).map((run) => (
                <article className="schedule-run-row" key={run.id}>
                  <span>{formatDateTime(run.finishedAt ?? run.startedAt)}</span>
                  <strong>{run.scheduleName}</strong>
                  <span>
                    {run.digestDate ? `${run.digestDate} 简报` : "无简报"}
                  </span>
                  <WorkspaceStatusBadge
                    label={getRunStatusLabel(run.status)}
                    tone={getRunStatusTone(run.status)}
                  />
                  <span>
                    成功 {run.successfulChannels}，失败 {run.failedChannels}
                    ，跳过 {run.skippedChannels}
                  </span>
                  <span>{run.triggerType}</span>
                  <span className="delivery-log-message">{run.message}</span>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">还没有记录任何定时投递运行。</p>
        )}
      </section>

      <section className="schedule-support-grid" aria-label="计划辅助信息">
        <details className="schedule-support-panel" open>
          <summary>定时导入（来源自动更新）</summary>
          <p>
            任务运行器在检查到期投递计划的同时，按这里的时间每天自动导入所有已启用来源，为公开快讯提供新内容。
          </p>
          <dl className="digest-delivery-list">
            <div>
              <dt>状态</dt>
              <dd>
                <WorkspaceStatusBadge
                  label={scheduledImportConfig.enabled ? "已启用" : "已停用"}
                  tone={scheduledImportConfig.enabled ? "success" : "neutral"}
                />
              </dd>
            </div>
            <div>
              <dt>每日时间</dt>
              <dd>
                {scheduledImportConfig.scheduleTime}（
                {scheduledImportConfig.timezone}）
              </dd>
            </div>
            <div>
              <dt>下次导入</dt>
              <dd>
                {scheduledImportConfig.nextRunAt
                  ? formatDateTime(scheduledImportConfig.nextRunAt)
                  : "下次任务运行器执行时立即导入"}
              </dd>
            </div>
            <div>
              <dt>最近定时导入</dt>
              <dd>
                {getRunStatusLabel(
                  scheduledImportConfig.lastRunStatus === "never_run"
                    ? undefined
                    : scheduledImportConfig.lastRunStatus
                )}{" "}
                - {formatDateTime(scheduledImportConfig.lastRunAt)}
                {scheduledImportConfig.lastRunMessage ? (
                  <small className="delivery-log-message">
                    {scheduledImportConfig.lastRunMessage}
                  </small>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>最近一次导入结果</dt>
              <dd>
                {latestImportRun
                  ? `${getRunStatusLabel(latestImportRun.status)} - 新增候选 ${latestImportRun.totalCandidatesCreated} 条 - ${formatDateTime(latestImportRun.finishedAt)}`
                  : "还没有导入记录。"}
                <Link className="action-link" href="/workspace/sources">
                  查看来源健康
                </Link>
              </dd>
            </div>
          </dl>
          <ScheduledImportActions
            enabled={scheduledImportConfig.enabled}
            scheduleTime={scheduledImportConfig.scheduleTime}
          />
        </details>

        <details className="schedule-support-panel" open>
          <summary>定时简报草稿（每日自动生成）</summary>
          <p>
            任务运行器在检查到期计划的同时，按这里的时间每天自动生成一份简报草稿；当天已有简报时跳过。发布始终由编辑把关，不会自动发布。
          </p>
          <dl className="digest-delivery-list">
            <div>
              <dt>状态</dt>
              <dd>
                <WorkspaceStatusBadge
                  label={scheduledDigestConfig.enabled ? "已启用" : "已停用"}
                  tone={scheduledDigestConfig.enabled ? "success" : "neutral"}
                />
              </dd>
            </div>
            <div>
              <dt>每日时间</dt>
              <dd>
                {scheduledDigestConfig.scheduleTime}（
                {scheduledDigestConfig.timezone}）
              </dd>
            </div>
            <div>
              <dt>下次生成</dt>
              <dd>
                {scheduledDigestConfig.nextRunAt
                  ? formatDateTime(scheduledDigestConfig.nextRunAt)
                  : "下次任务运行器执行时立即生成"}
              </dd>
            </div>
            <div>
              <dt>最近生成</dt>
              <dd>
                {getRunStatusLabel(
                  scheduledDigestConfig.lastRunStatus === "never_run"
                    ? undefined
                    : scheduledDigestConfig.lastRunStatus
                )}{" "}
                - {formatDateTime(scheduledDigestConfig.lastRunAt)}
                {scheduledDigestConfig.lastRunMessage ? (
                  <small className="delivery-log-message">
                    {scheduledDigestConfig.lastRunMessage}
                  </small>
                ) : null}
                <Link className="action-link" href="/workspace/digests">
                  查看简报工作台
                </Link>
              </dd>
            </div>
          </dl>
          <ScheduledDigestActions
            enabled={scheduledDigestConfig.enabled}
            scheduleTime={scheduledDigestConfig.scheduleTime}
          />
        </details>

        <details className="schedule-support-panel">
          <summary>任务运行器与到期运行</summary>
          <p>命令行运行器与本页使用相同的重复发送保护。</p>
          <RunDueSchedulesButton disabled={dueCount === 0} />
          <dl className="digest-delivery-list">
            <div>
              <dt>运行一次</dt>
              <dd>
                <code>npm run tasks:run-once</code>
              </dd>
            </div>
            <div>
              <dt>监听模式</dt>
              <dd>
                <code>npm run tasks:watch</code>
              </dd>
            </div>
            <div>
              <dt>最近任务运行器结果</dt>
              <dd>
                {latestTaskRunnerRun
                  ? `${getRunStatusLabel(latestTaskRunnerRun.status)} - 到期 ${latestTaskRunnerRun.dueScheduleCount} 个，投递日志 ${latestTaskRunnerRun.deliveryLogsCreated} 条 - ${formatDateTime(
                      latestTaskRunnerRun.finishedAt
                    )}`
                  : "还没有记录任何任务运行器执行。"}
              </dd>
            </div>
          </dl>
        </details>

        <details className="schedule-support-panel">
          <summary>当前 v0 规则</summary>
          <dl className="digest-delivery-list">
            <div>
              <dt>简报安全</dt>
              <dd>只有已发布的简报可以发送。</dd>
            </div>
            <div>
              <dt>重复保护</dt>
              <dd>
                定时运行会在同一本地日内跳过相同的计划 / 简报 /
                渠道组合。手动运行是明确的强制运行。
              </dd>
            </div>
            <div>
              <dt>失败处理</dt>
              <dd>单个渠道失败会记录一条失败投递日志，但不会中断其他渠道。</dd>
            </div>
          </dl>
        </details>

        <details className="schedule-support-panel">
          <summary>近期计划事件</summary>
          <WorkflowEventList
            events={recentScheduleEvents}
            title="审计记录"
            description="任务运行器与计划执行事件。"
          />
        </details>
      </section>
    </WorkspacePageShell>
  );
}
