import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import {
  getSystemHealthSummary,
  sanitizeOperationsText,
  type OperationsHealthStatus
} from "@/lib/operations-metrics";

export const dynamic = "force-dynamic";

function getHealthTone(status: OperationsHealthStatus) {
  if (status === "healthy") {
    return "success" as const;
  }

  if (status === "critical") {
    return "danger" as const;
  }

  if (status === "warning") {
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

const healthStatusLabels: Record<OperationsHealthStatus, string> = {
  healthy: "健康",
  warning: "警告",
  critical: "严重",
  unknown: "未知"
};

function getEventSummary(action: string): string {
  return action.replaceAll("_", " ").replaceAll(".", " / ");
}

export default function WorkspaceOperationsPage() {
  const operations = getSystemHealthSummary();
  const latestTaskRunnerRun = operations.taskRunnerSummary.latestRun;
  const quickLinks = [
    {
      label: "复查失败来源",
      href: "/workspace/sources",
      detail: `${operations.failedImports.length} 个来源问题`
    },
    {
      label: "复查失败投递",
      href: "/workspace/delivery",
      detail: `${operations.failedDeliveries.length} 次投递失败`
    },
    {
      label: "打开任务运行器日志",
      href: "/workspace/delivery/schedules",
      detail: latestTaskRunnerRun
        ? `${latestTaskRunnerRun.status} · ${formatDateTime(
            latestTaskRunnerRun.finishedAt
          )}`
        : "暂无任务运行器记录"
    },
    {
      label: "打开审计事件",
      href: "/workspace/operations/events",
      detail: `${operations.failedWorkflowEvents.length} 条失败事件`
    },
    {
      label: "处理重复组",
      href: "/workspace/duplicates",
      detail: "复查待处理的重复组"
    },
    {
      label: "打开简报工作台",
      href: "/workspace/digests",
      detail: "复查已生成和已发布的简报"
    }
  ];

  return (
    <WorkspacePageShell
      title="运维"
      description="覆盖来源健康、导入、投递、定时运行、任务运行器状态与工作流事件的内部可观测视图。"
      sectionLabel="运维管理"
    >
      <section className="operations-hero">
        <div className="operations-hero__status">
          <p className="eyebrow workspace-eyebrow">系统健康</p>
          <h2>{healthStatusLabels[operations.status]}</h2>
          <WorkspaceStatusBadge
            label={healthStatusLabels[operations.status]}
            tone={getHealthTone(operations.status)}
          />
          <ul>
            {operations.statusReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="operations-metric-grid" aria-label="运维指标">
          {operations.metrics.map((metric) => (
            <article
              className={`operations-metric operations-metric--${metric.status}`}
              key={metric.label}
            >
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>需要关注</h2>
            <p>这些条目应由维护者及时检查，避免演变成隐性的运维漂移。</p>
          </div>
          <Link className="action-link" href="/workspace/operations/events">
            查看事件日志
          </Link>
        </div>

        {operations.attentionItems.length > 0 ? (
          <div className="operations-attention-list">
            {operations.attentionItems.slice(0, 12).map((item) => (
              <Link
                className={`operations-attention-item operations-attention-item--${item.severity}`}
                href={item.href}
                key={item.id}
              >
                <div>
                  <span>{item.source}</span>
                  <strong>{item.title}</strong>
                  <p>{sanitizeOperationsText(item.description)}</p>
                </div>
                <WorkspaceStatusBadge
                  label={healthStatusLabels[item.severity]}
                  tone={getHealthTone(item.severity)}
                />
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">当前没有需要关注的运维事项。</p>
        )}
      </section>

      <section className="operations-layout">
        <main className="operations-layout__main">
          <section className="detail-panel operations-section">
            <div className="section-heading">
              <div>
                <h2>导入失败</h2>
                <p>导入失败或使用了回退层的来源。</p>
              </div>
            </div>
            {operations.failedImports.length > 0 ? (
              <div className="operations-compact-list">
                {operations.failedImports.slice(0, 12).map((item) => (
                  <Link
                    className="operations-compact-row"
                    href={item.href}
                    key={item.sourceId}
                  >
                    <div>
                      <strong>{item.sourceName}</strong>
                      <p>{item.message}</p>
                    </div>
                    <MetadataRow
                      items={[
                        { label: "状态", value: item.status },
                        {
                          label: "连续失败",
                          value: String(item.consecutiveFailureCount)
                        },
                        {
                          label: "最近失败",
                          value: formatDateTime(item.failedAt)
                        }
                      ]}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">当前没有可见的来源导入失败。</p>
            )}
          </section>

          <section className="detail-panel operations-section">
            <div className="section-heading">
              <div>
                <h2>投递失败</h2>
                <p>返回失败状态或错误输出的投递尝试。</p>
              </div>
            </div>
            {operations.failedDeliveries.length > 0 ? (
              <div className="operations-compact-list">
                {operations.failedDeliveries.slice(0, 12).map((item) => (
                  <Link
                    className="operations-compact-row"
                    href={item.href}
                    key={item.runId}
                  >
                    <div>
                      <strong>
                        {item.digestDate} - {item.channelName}
                      </strong>
                      <p>{item.message}</p>
                    </div>
                    <MetadataRow
                      items={[
                        { label: "类型", value: item.channelType },
                        {
                          label: "失败于",
                          value: formatDateTime(item.failedAt)
                        }
                      ]}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">当前没有可见的投递失败。</p>
            )}
          </section>

          <section className="detail-panel operations-section">
            <div className="section-heading">
              <div>
                <h2>定时运行失败</h2>
                <p>渠道结果为失败或部分成功的计划执行。</p>
              </div>
            </div>
            {operations.failedScheduledRuns.length > 0 ? (
              <div className="operations-compact-list">
                {operations.failedScheduledRuns.slice(0, 12).map((item) => (
                  <Link
                    className="operations-compact-row"
                    href={item.href}
                    key={item.runId}
                  >
                    <div>
                      <strong>{item.scheduleName}</strong>
                      <p>{item.message}</p>
                    </div>
                    <MetadataRow
                      items={[
                        { label: "状态", value: item.status },
                        {
                          label: "失败渠道",
                          value: String(item.failedChannels)
                        },
                        { label: "运行时间", value: formatDateTime(item.runAt) }
                      ]}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">当前没有可见的定时运行失败。</p>
            )}
          </section>
        </main>

        <aside className="operations-layout__aside">
          <section className="detail-panel operations-section">
            <h2>快捷入口</h2>
            <div className="operations-quick-links">
              {quickLinks.map((link) => (
                <Link href={link.href} key={link.href}>
                  <strong>{link.label}</strong>
                  <span>{link.detail}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="detail-panel operations-section">
            <h2>近期活动</h2>
            {operations.recentEvents.length > 0 ? (
              <div className="workflow-event-list">
                {operations.recentEvents.slice(0, 10).map((event) => (
                  <Link
                    className="workflow-event-item"
                    href="/workspace/operations/events"
                    key={event.id}
                  >
                    <div>
                      <strong>{getEventSummary(event.action)}</strong>
                      <p>
                        {sanitizeOperationsText(
                          event.metadata?.message ?? event.actorType
                        )}
                      </p>
                    </div>
                    <span>{formatDateTime(event.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">还没有记录任何工作流事件。</p>
            )}
          </section>
        </aside>
      </section>
    </WorkspacePageShell>
  );
}
