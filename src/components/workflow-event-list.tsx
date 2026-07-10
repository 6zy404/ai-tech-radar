import type { WorkflowEvent } from "@/types/content";

interface WorkflowEventListProps {
  title?: string;
  description?: string;
  events: WorkflowEvent[];
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function getEventLabel(action: string): string {
  return action.replaceAll("_", " ").replaceAll(".", " / ");
}

function getEventSummary(event: WorkflowEvent): string {
  const metadata = event.metadata ?? {};
  const status =
    typeof metadata.status === "string" ? metadata.status : undefined;
  const message =
    typeof metadata.message === "string" ? metadata.message : undefined;
  const errorMessage =
    typeof metadata.errorMessage === "string"
      ? metadata.errorMessage
      : undefined;

  return errorMessage ?? message ?? status ?? event.actorType;
}

export function WorkflowEventList({
  title = "工作流事件",
  description = "该对象最近的内部状态变化。",
  events
}: WorkflowEventListProps) {
  return (
    <section className="detail-panel workflow-event-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">审计</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {events.length > 0 ? (
        <div className="workflow-event-list">
          {events.map((event) => (
            <article className="workflow-event-item" key={event.id}>
              <div>
                <strong>{getEventLabel(event.action)}</strong>
                <p>{getEventSummary(event)}</p>
              </div>
              <span>{formatDateTime(event.createdAt)}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">还没有记录任何工作流事件。</p>
      )}
    </section>
  );
}
