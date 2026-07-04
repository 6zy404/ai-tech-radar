import type { WorkflowEvent } from "@/types/content";

interface WorkflowEventListProps {
  title?: string;
  description?: string;
  events: WorkflowEvent[];
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en");
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
  title = "Workflow events",
  description = "Recent internal state changes for this object.",
  events
}: WorkflowEventListProps) {
  return (
    <section className="detail-panel workflow-event-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Audit</p>
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
        <p className="empty-state">No workflow event has been recorded yet.</p>
      )}
    </section>
  );
}
