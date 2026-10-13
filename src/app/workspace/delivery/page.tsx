import Link from "next/link";

import { DeliveryChannelActions } from "@/components/delivery-channel-actions";
import { DeliveryChannelForm } from "@/components/delivery-channel-form";
import { DeliveryRunActions } from "@/components/delivery-run-actions";
import { PushWorkspaceActions } from "@/components/push-workspace-actions";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
import {
  getDeliveryChannels,
  getDeliveryRuns,
  maskEndpointUrl
} from "@/lib/delivery-workflow";
import { getAllTags } from "@/lib/content";
import { getTodayDateString } from "@/lib/digest-store";
import { readPushVapidConfig } from "@/lib/push-config";
import {
  readPushSubscriptionStore,
  summarizePushSubscriptions
} from "@/lib/push-subscriptions";
import { getScheduledDeliveries } from "@/lib/scheduled-delivery-workflow";
import { getRecentWorkflowEvents } from "@/lib/workflow-events";
import type { DeliveryStatus } from "@/types/content";

export const dynamic = "force-dynamic";

function getDeliveryStatusTone(status: DeliveryStatus | undefined) {
  if (status === "success") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

const deliveryStatusLabels: Record<string, string> = {
  pending: "进行中",
  success: "成功",
  failed: "失败"
};

function getDeliveryStatusLabel(status: DeliveryStatus | undefined): string {
  return status ? (deliveryStatusLabels[status] ?? status) : "从未发送";
}

function getRunMessage(
  run: ReturnType<typeof getDeliveryRuns>[number]
): string {
  if (run.errorMessage) {
    return run.errorMessage;
  }

  if (run.responseBodyPreview) {
    return run.responseBodyPreview;
  }

  return run.status === "success" ? "投递成功。" : "无响应内容。";
}

export default function WorkspaceDeliveryPage() {
  const channels = getDeliveryChannels();
  const runs = getDeliveryRuns();
  const schedules = getScheduledDeliveries();
  const enabledCount = channels.filter((channel) => channel.enabled).length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const enabledScheduleCount = schedules.filter(
    (schedule) => schedule.enabled
  ).length;
  const recentDeliveryEvents = getRecentWorkflowEvents({
    entityTypes: ["delivery_run"],
    limit: 6
  });
  const latestRun = runs[0];
  const pushSummary = summarizePushSubscriptions(readPushSubscriptionStore());
  const pushConfigured = readPushVapidConfig() !== null;
  const tagNames = new Map(getAllTags().map((tag) => [tag.id, tag.name]));
  const recentPushEvents = getRecentWorkflowEvents({
    entityTypes: ["push_run"],
    limit: 5
  });

  return (
    <WorkspacePageShell
      className="workspace-delivery-console"
      title="简报投递"
      description="管理内部投递渠道并查看投递日志。"
      sectionLabel="投递"
      actions={
        <a
          className="action-button action-button--accent"
          href="#create-channel"
        >
          创建渠道
        </a>
      }
      securityNote={
        <>
          <strong>内部工作台</strong> · 需要路由保护 · 投递端点属于敏感信息。
        </>
      }
    >
      <section className="delivery-console-summary" aria-label="投递摘要">
        <article className="delivery-console-summary__card">
          <span>已启用渠道</span>
          <strong>
            {enabledCount}/{channels.length}
          </strong>
          <p>{channels.length - enabledCount} 个已停用</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>渠道总数</span>
          <strong>{channels.length}</strong>
          <p>
            {enabledScheduleCount}/{schedules.length} 个计划已启用
          </p>
        </article>
        <article className="delivery-console-summary__card">
          <span>投递失败</span>
          <strong>{failedCount}</strong>
          <p>共 {runs.length} 条投递日志</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>最近投递</span>
          <strong>{getDeliveryStatusLabel(latestRun?.status)}</strong>
          <p>{formatDateTime(latestRun?.finishedAt ?? latestRun?.startedAt)}</p>
        </article>
      </section>

      <section
        id="delivery-channels"
        className="detail-panel delivery-console-panel"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">投递渠道</p>
            <h2>已配置渠道</h2>
            <p>
              通用 Webhook、飞书、Telegram 与 Discord 渠道仅限工作台使用。端点
              URL 与 bot token 在这里做了脱敏，且永远不会出现在用户端页面。
            </p>
          </div>
          <Link className="action-link" href="/workspace/delivery/schedules">
            管理定时投递
          </Link>
        </div>

        <section
          id="create-channel"
          className="delivery-create-panel"
          aria-label="创建投递渠道"
        >
          <div className="delivery-create-panel__summary">
            <div>
              <h3>创建投递渠道</h3>
              <p>
                添加通用 Webhook、飞书机器人、Telegram 机器人或 Discord
                Webhook。本地验证可使用 mock://success 或 mock://failed。
              </p>
            </div>
            <a className="action-link" href="#delivery-channels">
              收起表单
            </a>
          </div>
          <div className="delivery-create-panel__body">
            <DeliveryChannelForm />
          </div>
        </section>

        {channels.length > 0 ? (
          <div
            className="delivery-table-scroll"
            role="region"
            aria-label="投递渠道表格"
          >
            <div className="delivery-channel-table delivery-channel-table--console">
              <div className="delivery-channel-table__head delivery-channel-table__head--console">
                <span>名称</span>
                <span>类型</span>
                <span>格式</span>
                <span>状态</span>
                <span>最近投递</span>
                <span>最近结果</span>
                <span>操作</span>
              </div>
              {channels.map((channel) => (
                <article
                  className="delivery-channel-row delivery-channel-row--console"
                  key={channel.id}
                >
                  <div className="delivery-channel-row__identity">
                    <strong>{channel.name}</strong>
                    <p>{channel.description || "暂无描述。"}</p>
                    <code className="delivery-masked-endpoint">
                      {maskEndpointUrl(channel.endpointUrl)}
                    </code>
                  </div>
                  <div className="delivery-channel-row__cell" data-label="类型">
                    <span>{getDeliveryChannelTypeLabel(channel.type)}</span>
                  </div>
                  <div className="delivery-channel-row__cell" data-label="格式">
                    <span>{channel.format}</span>
                  </div>
                  <div className="delivery-channel-row__cell" data-label="状态">
                    <WorkspaceStatusBadge
                      label={channel.enabled ? "已启用" : "已停用"}
                      tone={channel.enabled ? "success" : "neutral"}
                    />
                  </div>
                  <div
                    className="delivery-channel-row__cell"
                    data-label="最近投递"
                  >
                    <span>{formatDateTime(channel.lastDeliveredAt)}</span>
                  </div>
                  <div
                    className="delivery-channel-row__cell delivery-channel-row__last-status"
                    data-label="最近结果"
                  >
                    <WorkspaceStatusBadge
                      label={getDeliveryStatusLabel(channel.lastDeliveryStatus)}
                      tone={getDeliveryStatusTone(channel.lastDeliveryStatus)}
                    />
                    <small>
                      {channel.lastDeliveryMessage ?? "暂无投递记录。"}
                    </small>
                  </div>
                  <div className="delivery-channel-row__actions">
                    <Link
                      className="action-link delivery-console-action"
                      href="/workspace/digests"
                    >
                      测试渠道
                    </Link>
                    <a
                      className="action-link delivery-console-action"
                      href="#delivery-logs"
                    >
                      查看日志
                    </a>
                    <DeliveryChannelActions
                      channelId={channel.id}
                      enabled={channel.enabled}
                    />
                  </div>
                  <details className="delivery-channel-row__edit">
                    <summary>编辑渠道</summary>
                    <DeliveryChannelForm channel={channel} />
                  </details>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">还没有配置任何投递渠道。</p>
        )}
      </section>

      <section
        id="delivery-logs"
        className="detail-panel delivery-console-panel"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">投递日志</p>
            <h2>近期发送</h2>
            <p>
              每次发送都会生成一条日志。失败的发送可以在不改动简报内容的情况下重试。
            </p>
          </div>
        </div>

        {runs.length > 0 ? (
          <div
            className="delivery-table-scroll"
            role="region"
            aria-label="投递日志表格"
          >
            <div className="delivery-log-table">
              <div className="delivery-log-table__head">
                <span>时间</span>
                <span>简报日期</span>
                <span>渠道</span>
                <span>状态</span>
                <span>HTTP</span>
                <span>消息</span>
                <span>重试</span>
              </div>
              {runs.slice(0, 24).map((run) => (
                <article className="delivery-log-row" key={run.id}>
                  <span>{formatDateTime(run.finishedAt ?? run.startedAt)}</span>
                  <Link href={`/workspace/digests/${run.digestDate}`}>
                    {run.digestDate}
                  </Link>
                  <span>{run.channelName}</span>
                  <WorkspaceStatusBadge
                    label={getDeliveryStatusLabel(run.status)}
                    tone={getDeliveryStatusTone(run.status)}
                  />
                  <span>{run.responseStatus?.toString() ?? "无"}</span>
                  <span className="delivery-log-message">
                    {getRunMessage(run)}
                  </span>
                  <DeliveryRunActions runId={run.id} status={run.status} />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">还没有记录任何投递发送。</p>
        )}
      </section>

      <section
        id="reader-push"
        className="detail-panel delivery-console-panel"
        aria-labelledby="reader-push-title"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">读者推送</p>
            <h2 id="reader-push-title">新信号提醒</h2>
            <p>
              读者在「我关注的」里打开「有新信号时提醒我」后，这里推送指定日期发布、命中其关注话题的信号，每位订阅者一条合并通知。同一条信号只推一次；浏览器报订阅失效（404
              / 410）的记录会被删除。这里只显示数量，不显示推送地址。
            </p>
          </div>
        </div>
        {pushConfigured ? null : (
          <p className="empty-state">
            推送未配置：需要在环境变量里设置 PUSH_VAPID_PUBLIC_KEY 与
            PUSH_VAPID_PRIVATE_KEY（生成：node
            scripts/generate-vapid-keys.mjs）。未配置时读者端不显示开关。
          </p>
        )}
        <section className="delivery-console-summary" aria-label="推送订阅摘要">
          <article className="delivery-console-summary__card">
            <span>订阅者</span>
            <strong>{pushSummary.total}</strong>
            <p>浏览器订阅数</p>
          </article>
          <article className="delivery-console-summary__card">
            <span>已推送信号</span>
            <strong>{pushSummary.pushedSignalCount}</strong>
            <p>这些信号不会再推</p>
          </article>
        </section>
        {pushSummary.byTopic.length > 0 ? (
          <ul className="push-topic-counts" aria-label="各话题订阅数">
            {pushSummary.byTopic.map((entry) => (
              <li key={entry.topicId}>
                {tagNames.get(entry.topicId) ?? entry.topicId}
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>
        ) : null}
        <PushWorkspaceActions
          defaultDate={getTodayDateString()}
          enabled={pushConfigured}
        />
        {recentPushEvents.length > 0 ? (
          <WorkflowEventList
            events={recentPushEvents}
            title="推送记录"
            description="每次推送的数量记录，不含任何推送地址。"
          />
        ) : null}
      </section>

      <details className="delivery-audit-panel">
        <summary>近期投递事件</summary>
        <WorkflowEventList
          events={recentDeliveryEvents}
          title="审计记录"
          description="投递发送成功与失败的轻量审计记录。"
        />
      </details>
    </WorkspacePageShell>
  );
}
