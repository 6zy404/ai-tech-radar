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

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en");
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
      title="Workflow Events"
      description="Internal audit trail for key workflow state changes, failures, task runner runs, delivery results, and source imports."
      sectionLabel="Admin Operations"
    >
      <section className="detail-panel operations-section">
        <div className="section-heading">
          <div>
            <h2>Event filters</h2>
            <p>
              Narrow recent WorkflowEvent records by entity type, action, or
              actor type. Snapshots are truncated and sanitized for workspace
              review.
            </p>
          </div>
          <Link className="action-link" href="/workspace/operations">
            Back to Operations
          </Link>
        </div>

        <form
          className="operations-event-filter"
          action="/workspace/operations/events"
        >
          <label>
            Entity type
            <select name="entityType" defaultValue={entityTypeFilter}>
              <option value="">All</option>
              {entityTypes.map((entityType) => (
                <option value={entityType} key={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select name="action" defaultValue={actionFilter}>
              <option value="">All</option>
              {actions.map((action) => (
                <option value={action} key={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label>
            Actor type
            <select name="actorType" defaultValue={actorTypeFilter}>
              <option value="">All</option>
              {actorTypes.map((actorType) => (
                <option value={actorType} key={actorType}>
                  {actorType}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply filters</button>
          <Link href="/workspace/operations/events">Clear</Link>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Events</h2>
            <p>
              Showing {filteredEvents.length} of {events.length} stored event
              records.
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
                    { label: "Entity", value: event.entityId },
                    { label: "Actor", value: event.actorType },
                    {
                      label: "Actor ID",
                      value: event.actorId ?? "system/local"
                    }
                  ]}
                />

                <details className="operations-event-card__detail">
                  <summary>View sanitized event detail</summary>
                  <div className="operations-event-card__snapshots">
                    <div>
                      <strong>Metadata</strong>
                      <pre>{formatOperationsJsonPreview(event.metadata)}</pre>
                    </div>
                    <div>
                      <strong>Before</strong>
                      <pre>
                        {formatOperationsJsonPreview(event.beforeSnapshot)}
                      </pre>
                    </div>
                    <div>
                      <strong>After</strong>
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
          <p className="empty-state">
            No workflow events match the selected filters.
          </p>
        )}
      </section>
    </WorkspacePageShell>
  );
}
