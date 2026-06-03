import Link from "next/link";

import { DeliveryChannelActions } from "@/components/delivery-channel-actions";
import { DeliveryChannelForm } from "@/components/delivery-channel-form";
import { DeliveryRunActions } from "@/components/delivery-run-actions";
import { MetadataRow } from "@/components/metadata-row";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
import {
  getDeliveryChannels,
  getDeliveryRuns,
  maskEndpointUrl
} from "@/lib/delivery-workflow";
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
    return "Not recorded";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en");
}

export default function WorkspaceDeliveryPage() {
  const channels = getDeliveryChannels();
  const runs = getDeliveryRuns();
  const schedules = getScheduledDeliveries();
  const enabledCount = channels.filter((channel) => channel.enabled).length;
  const successCount = runs.filter((run) => run.status === "success").length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const enabledScheduleCount = schedules.filter((schedule) => schedule.enabled).length;
  const recentDeliveryEvents = getRecentWorkflowEvents({
    entityTypes: ["delivery_run"],
    limit: 6
  });
  const latestRun = runs[0];
  const disabledCount = channels.length - enabledCount;
  const latestRunLabel = latestRun
    ? `${latestRun.status} - ${formatDateTime(latestRun.finishedAt ?? latestRun.startedAt)}`
    : "No delivery yet";

  return (
    <WorkspacePageShell
      title="Digest Delivery"
      description="Manage internal delivery channels and inspect manual digest delivery logs. Delivery only sends published Daily Digest records."
      sectionLabel="Delivery"
    >
      <WorkspaceListToolbar
        label={`${enabledCount}/${channels.length} channels enabled`}
        detail={`${runs.length} delivery run(s), ${successCount} succeeded, ${failedCount} failed. ${enabledScheduleCount}/${schedules.length} schedules enabled.`}
      />

      <div className="workspace-metric-strip delivery-metric-strip">
        <article className="workspace-metric-card">
          <span>Enabled channels</span>
          <strong>{enabledCount}</strong>
          <p>{disabledCount} disabled</p>
        </article>
        <article className="workspace-metric-card">
          <span>Schedules</span>
          <strong>
            {enabledScheduleCount}/{schedules.length}
          </strong>
          <p>enabled for runner</p>
        </article>
        <article className="workspace-metric-card">
          <span>Last delivery</span>
          <strong>{latestRun?.status ?? "never sent"}</strong>
          <p>{latestRunLabel}</p>
        </article>
        <article className="workspace-metric-card">
          <span>Failed runs</span>
          <strong>{failedCount}</strong>
          <p>{runs.length} total runs</p>
        </article>
      </div>

      <div className="delivery-workspace-layout">
        <main className="delivery-workspace-layout__main">
          <section className="detail-panel delivery-section">
            <div className="section-heading">
              <div>
                <h2>Delivery channels</h2>
                <p>
                  Generic webhook and Feishu bot webhook channels are
                  workspace-only. Endpoint URLs are masked here and never appear
                  in user-facing pages.
                </p>
              </div>
              <Link className="action-link" href="/workspace/delivery/schedules">
                Manage schedules
              </Link>
            </div>

            <details className="workspace-drawer-lite">
              <summary>Create delivery channel</summary>
              <div className="workspace-drawer-lite__body">
                <p>
                  Add a generic webhook or Feishu bot webhook. Use a real HTTPS
                  endpoint for integration tests, or mock://success /
                  mock://failed for local validation.
                </p>
                <DeliveryChannelForm />
              </div>
            </details>

            {channels.length > 0 ? (
              <div className="delivery-channel-table">
                <div className="delivery-channel-table__head">
                  <span>Channel</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Last delivery</span>
                  <span>Endpoint</span>
                  <span>Actions</span>
                </div>
                {channels.map((channel) => (
                  <article className="delivery-channel-row" key={channel.id}>
                    <div className="delivery-channel-row__identity">
                      <strong>{channel.name}</strong>
                      <p>{channel.description || "No description provided."}</p>
                    </div>
                    <div className="delivery-channel-row__cell">
                      <span>{getDeliveryChannelTypeLabel(channel.type)}</span>
                      <small>{channel.format}</small>
                    </div>
                    <div className="delivery-channel-row__cell">
                      <WorkspaceStatusBadge
                        label={channel.enabled ? "enabled" : "disabled"}
                        tone={channel.enabled ? "success" : "neutral"}
                      />
                      <small>{channel.lastDeliveryStatus ?? "never sent"}</small>
                    </div>
                    <div className="delivery-channel-row__cell">
                      <span>{formatDateTime(channel.lastDeliveredAt)}</span>
                      <small>{channel.lastDeliveryMessage ?? "No delivery yet."}</small>
                    </div>
                    <div className="delivery-channel-row__cell delivery-channel-row__endpoint">
                      <span>{maskEndpointUrl(channel.endpointUrl)}</span>
                    </div>
                    <div className="delivery-channel-row__actions">
                      <DeliveryChannelActions
                        channelId={channel.id}
                        enabled={channel.enabled}
                      />
                    </div>
                    <details className="delivery-channel-row__edit">
                      <summary>Edit channel configuration</summary>
                      <DeliveryChannelForm channel={channel} />
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No delivery channel has been configured.</p>
            )}
          </section>

          <section className="detail-panel delivery-section">
            <div className="section-heading">
              <div>
                <h2>Delivery logs</h2>
                <p>
                  Each manual send creates a log. Failed sends can be retried
                  without changing the digest content.
                </p>
              </div>
            </div>

            {runs.length > 0 ? (
              <div className="delivery-log-list">
                {runs.slice(0, 24).map((run) => (
                  <article className="delivery-log-card" key={run.id}>
                    <div className="delivery-log-card__header">
                      <div>
                        <strong>
                          <Link href={`/workspace/digests/${run.digestDate}`}>
                            {run.digestDate}
                          </Link>
                        </strong>
                        <span>
                          {run.channelName} -{" "}
                          {getDeliveryChannelTypeLabel(run.channelType)}
                        </span>
                      </div>
                      <WorkspaceStatusBadge
                        label={run.status}
                        tone={getDeliveryStatusTone(run.status)}
                      />
                    </div>
                    <MetadataRow
                      items={[
                        { label: "Started", value: formatDateTime(run.startedAt) },
                        {
                          label: "Finished",
                          value: formatDateTime(run.finishedAt)
                        },
                        {
                          label: "HTTP status",
                          value: run.responseStatus?.toString() ?? "n/a"
                        },
                        {
                          label: "Retry of",
                          value: run.retryOfDeliveryRunId
                            ? run.retryOfDeliveryRunId.slice(0, 18)
                            : "original"
                        }
                      ]}
                    />
                    {run.errorMessage ? (
                      <p className="delivery-error-message">{run.errorMessage}</p>
                    ) : null}
                    <DeliveryRunActions runId={run.id} status={run.status} />
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No delivery runs have been recorded yet.</p>
            )}
          </section>
        </main>

        <aside className="delivery-workspace-layout__aside">
          <section className="detail-panel delivery-section">
            <h2>Current scope</h2>
            <p>
              Delivery Channel Expansion v1 supports generic webhook and Feishu
              bot webhook adapters. Scheduled Delivery v0 adds a local runner
              for enabled schedules. Email, Telegram, Discord, subscriptions,
              production cron, and account-based delivery are intentionally left
              for later.
            </p>
          </section>

          <WorkflowEventList
            events={recentDeliveryEvents}
            title="Recent delivery events"
            description="Low-weight audit trail for delivery send success and failure."
          />
        </aside>
      </div>
    </WorkspacePageShell>
  );
}
