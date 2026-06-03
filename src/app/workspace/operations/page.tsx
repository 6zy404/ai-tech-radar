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
    return "Not recorded";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en");
}

function getEventSummary(action: string): string {
  return action.replaceAll("_", " ").replaceAll(".", " / ");
}

export default function WorkspaceOperationsPage() {
  const operations = getSystemHealthSummary();
  const latestTaskRunnerRun = operations.taskRunnerSummary.latestRun;
  const quickLinks = [
    {
      label: "Review failed sources",
      href: "/workspace/sources",
      detail: `${operations.failedImports.length} source issue(s)`
    },
    {
      label: "Review failed deliveries",
      href: "/workspace/delivery",
      detail: `${operations.failedDeliveries.length} failed delivery run(s)`
    },
    {
      label: "Open task runner logs",
      href: "/workspace/delivery/schedules",
      detail: latestTaskRunnerRun
        ? `${latestTaskRunnerRun.status} at ${formatDateTime(
            latestTaskRunnerRun.finishedAt
          )}`
        : "No task runner run recorded"
    },
    {
      label: "Open audit events",
      href: "/workspace/operations/events",
      detail: `${operations.failedWorkflowEvents.length} failure event(s)`
    },
    {
      label: "Resolve duplicates",
      href: "/workspace/duplicates",
      detail: "Review open duplicate groups"
    },
    {
      label: "Open digest workspace",
      href: "/workspace/digests",
      detail: "Review generated and published digests"
    }
  ];

  return (
    <WorkspacePageShell
      title="Operations"
      description="Internal observability view for source health, imports, delivery, scheduled runs, task runner state, and workflow events."
      sectionLabel="Admin Operations"
    >
      <section className="operations-hero">
        <div className="operations-hero__status">
          <p className="eyebrow workspace-eyebrow">System health</p>
          <h2>{operations.status}</h2>
          <WorkspaceStatusBadge
            label={operations.status}
            tone={getHealthTone(operations.status)}
          />
          <ul>
            {operations.statusReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="operations-metric-grid" aria-label="Operations metrics">
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
            <h2>Attention required</h2>
            <p>
              Items that should be checked by a maintainer before they become
              hidden operational drift.
            </p>
          </div>
          <Link className="action-link" href="/workspace/operations/events">
            View event log
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
                  label={item.severity}
                  tone={getHealthTone(item.severity)}
                />
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">No operation currently requires attention.</p>
        )}
      </section>

      <section className="operations-layout">
        <main className="operations-layout__main">
          <section className="detail-panel operations-section">
            <div className="section-heading">
              <div>
                <h2>Failed imports</h2>
                <p>Sources with failed or fallback imports.</p>
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
                        { label: "Status", value: item.status },
                        {
                          label: "Failures",
                          value: String(item.consecutiveFailureCount)
                        },
                        {
                          label: "Last failed",
                          value: formatDateTime(item.failedAt)
                        }
                      ]}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">No failed source import is visible.</p>
            )}
          </section>

          <section className="detail-panel operations-section">
            <div className="section-heading">
              <div>
                <h2>Failed deliveries</h2>
                <p>Delivery attempts that returned failed status or error output.</p>
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
                        { label: "Type", value: item.channelType },
                        {
                          label: "Failed",
                          value: formatDateTime(item.failedAt)
                        }
                      ]}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">No failed delivery run is visible.</p>
            )}
          </section>

          <section className="detail-panel operations-section">
            <div className="section-heading">
              <div>
                <h2>Failed scheduled runs</h2>
                <p>Schedule executions with failed or partial channel results.</p>
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
                        { label: "Status", value: item.status },
                        {
                          label: "Failed channels",
                          value: String(item.failedChannels)
                        },
                        { label: "Run time", value: formatDateTime(item.runAt) }
                      ]}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">No failed scheduled run is visible.</p>
            )}
          </section>
        </main>

        <aside className="operations-layout__aside">
          <section className="detail-panel operations-section">
            <h2>Quick links</h2>
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
            <h2>Recent activity</h2>
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
                      <p>{sanitizeOperationsText(event.metadata?.message ?? event.actorType)}</p>
                    </div>
                    <span>{formatDateTime(event.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">No workflow event has been recorded yet.</p>
            )}
          </section>
        </aside>
      </section>
    </WorkspacePageShell>
  );
}
