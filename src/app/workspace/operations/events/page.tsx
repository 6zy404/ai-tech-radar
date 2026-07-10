import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  formatOperationsJsonPreview,
  sanitizeOperationsText
} from "@/lib/operations-metrics";
import { getWorkflowEvents } from "@/lib/workflow-events";
import type { WorkflowEvent } from "@/types/content";

export const dynamic = "force-dynamic";

interface OperationsEventsPageProps {
  searchParams?: Promise<{
    entityType?: string | string[];
    action?: string | string[];
    actorType?: string | string[];
  }>;
}

function getSearchParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function getEventSummary(event: WorkflowEvent): string {
  const metadata = event.metadata ?? {};

  return sanitizeOperationsText(
    metadata.errorMessage ??
      metadata.message ??
      metadata.status ??
      event.actorType
  );
}

export default async function WorkspaceOperationsEventsPage({
  searchParams
}: OperationsEventsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const events = getWorkflowEvents();
  const entityTypeFilter = getSearchParam(resolvedSearchParams.entityType);
  const actionFilter = getSearchParam(resolvedSearchParams.action);
  const actorTypeFilter = getSearchParam(resolvedSearchParams.actorType);
  const entityTypes = uniqueSorted(events.map((event) => event.entityType));
  const actions = uniqueSorted(events.map((event) => event.action));
  const actorTypes = uniqueSorted(events.map((event) => event.actorType));
  const filteredEvents = events.filter((event) => {
    if (entityTypeFilter && event.entityType !== entityTypeFilter) {
      return false;
    }

    if (actionFilter && event.action !== actionFilter) {
      return false;
    }

    if (actorTypeFilter && event.actorType !== actorTypeFilter) {
      return false;
    }

    return true;
  });

  return (
    <WorkspacePageShell
      title="工作流事件"
      description="关键工作流状态变化、失败、任务运行器运行、投递结果与来源导入的内部审计记录。"
      sectionLabel="运维管理"
    >
      <section className="detail-panel operations-section">
        <div className="section-heading">
          <div>
            <h2>事件筛选</h2>
            <p>
              按实体类型、动作或操作者类型缩小近期工作流事件的范围。快照已截断并脱敏，供工作台审阅。
            </p>
          </div>
          <Link className="action-link" href="/workspace/operations">
            返回运维
          </Link>
        </div>

        <form
          className="operations-event-filter"
          action="/workspace/operations/events"
        >
          <label>
            实体类型
            <select name="entityType" defaultValue={entityTypeFilter}>
              <option value="">全部</option>
              {entityTypes.map((entityType) => (
                <option value={entityType} key={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </label>
          <label>
            动作
            <select name="action" defaultValue={actionFilter}>
              <option value="">全部</option>
              {actions.map((action) => (
                <option value={action} key={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label>
            操作者类型
            <select name="actorType" defaultValue={actorTypeFilter}>
              <option value="">全部</option>
              {actorTypes.map((actorType) => (
                <option value={actorType} key={actorType}>
                  {actorType}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">应用筛选</button>
          <Link href="/workspace/operations/events">清空</Link>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>事件</h2>
            <p>
              当前显示 {filteredEvents.length} / {events.length} 条已存储事件。
            </p>
          </div>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="operations-event-list">
            {filteredEvents.slice(0, 80).map((event) => (
              <article className="operations-event-card" key={event.id}>
                <div className="operations-event-card__header">
                  <div>
                    <span>{event.entityType}</span>
                    <h2>{event.action}</h2>
                    <p>{getEventSummary(event)}</p>
                  </div>
                  <time>{formatDateTime(event.createdAt)}</time>
                </div>

                <MetadataRow
                  items={[
                    { label: "实体", value: event.entityId },
                    { label: "操作者", value: event.actorType },
                    {
                      label: "操作者 ID",
                      value: event.actorId ?? "system/local"
                    }
                  ]}
                />

                <details className="operations-event-card__detail">
                  <summary>查看脱敏后的事件详情</summary>
                  <div className="operations-event-card__snapshots">
                    <div>
                      <strong>元数据</strong>
                      <pre>{formatOperationsJsonPreview(event.metadata)}</pre>
                    </div>
                    <div>
                      <strong>变更前</strong>
                      <pre>
                        {formatOperationsJsonPreview(event.beforeSnapshot)}
                      </pre>
                    </div>
                    <div>
                      <strong>变更后</strong>
                      <pre>
                        {formatOperationsJsonPreview(event.afterSnapshot)}
                      </pre>
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">没有匹配当前筛选条件的工作流事件。</p>
        )}
      </section>
    </WorkspacePageShell>
  );
}
