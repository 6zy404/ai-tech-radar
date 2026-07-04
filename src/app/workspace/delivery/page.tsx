import Link from "next/link";

import { DeliveryChannelActions } from "@/components/delivery-channel-actions";
import { DeliveryChannelForm } from "@/components/delivery-channel-form";
import { DeliveryRunActions } from "@/components/delivery-run-actions";
import { WorkflowEventList } from "@/components/workflow-event-list";
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

function getRunMessage(
  run: ReturnType<typeof getDeliveryRuns>[number]
): string {
  if (run.errorMessage) {
    return run.errorMessage;
  }

  if (run.responseBodyPreview) {
    return run.responseBodyPreview;
  }

  return run.status === "success" ? "Delivery succeeded." : "No response body.";
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

  return (
    <WorkspacePageShell
      className="workspace-delivery-console"
      title="Digest Delivery"
      description="Manage internal delivery channels and inspect delivery logs."
      sectionLabel="Delivery"
      actions={
        <a
          className="action-button action-button--accent"
          href="#create-channel"
        >
          Create channel
        </a>
      }
      securityNote={
        <>
          <strong>Internal workspace</strong> · Protected routes required ·
          Delivery endpoints are sensitive.
        </>
      }
    >
      <section
        className="delivery-console-summary"
        aria-label="Delivery summary"
      >
        <article className="delivery-console-summary__card">
          <span>Channels enabled</span>
          <strong>
            {enabledCount}/{channels.length}
          </strong>
          <p>{channels.length - enabledCount} disabled</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>Total channels</span>
          <strong>{channels.length}</strong>
          <p>
            {enabledScheduleCount}/{schedules.length} schedules enabled
          </p>
        </article>
        <article className="delivery-console-summary__card">
          <span>Failed deliveries</span>
          <strong>{failedCount}</strong>
          <p>{runs.length} total delivery logs</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>Last delivery</span>
          <strong>{latestRun?.status ?? "never sent"}</strong>
          <p>{formatDateTime(latestRun?.finishedAt ?? latestRun?.startedAt)}</p>
        </article>
      </section>

      <section
        id="delivery-channels"
        className="detail-panel delivery-console-panel"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">Delivery channels</p>
            <h2>Configured channels</h2>
            <p>
              Generic webhook and Feishu bot webhook channels are
              workspace-only. Endpoint URLs are masked here and never appear in
              user-facing pages.
            </p>
          </div>
          <Link className="action-link" href="/workspace/delivery/schedules">
            Manage schedules
          </Link>
        </div>

        <section
          id="create-channel"
          className="delivery-create-panel"
          aria-label="Create delivery channel"
        >
          <div className="delivery-create-panel__summary">
            <div>
              <h3>Create delivery channel</h3>
              <p>
                Add a generic webhook or Feishu bot webhook. Use mock://success
                or mock://failed for local validation.
              </p>
            </div>
            <a className="action-link" href="#delivery-channels">
              Close form
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
            aria-label="Delivery channels table"
          >
            <div className="delivery-channel-table delivery-channel-table--console">
              <div className="delivery-channel-table__head delivery-channel-table__head--console">
                <span>Name</span>
                <span>Type</span>
                <span>Format</span>
                <span>Status</span>
                <span>Last delivery</span>
                <span>Last status</span>
                <span>Actions</span>
              </div>
              {channels.map((channel) => (
                <article
                  className="delivery-channel-row delivery-channel-row--console"
                  key={channel.id}
                >
                  <div className="delivery-channel-row__identity">
                    <strong>{channel.name}</strong>
                    <p>{channel.description || "No description provided."}</p>
                    <code className="delivery-masked-endpoint">
                      {maskEndpointUrl(channel.endpointUrl)}
                    </code>
                  </div>
                  <div className="delivery-channel-row__cell" data-label="Type">
                    <span>{getDeliveryChannelTypeLabel(channel.type)}</span>
                  </div>
                  <div
                    className="delivery-channel-row__cell"
                    data-label="Format"
                  >
                    <span>{channel.format}</span>
                  </div>
                  <div
                    className="delivery-channel-row__cell"
                    data-label="Status"
                  >
                    <WorkspaceStatusBadge
                      label={channel.enabled ? "enabled" : "disabled"}
                      tone={channel.enabled ? "success" : "neutral"}
                    />
                  </div>
                  <div
                    className="delivery-channel-row__cell"
                    data-label="Last delivery"
                  >
                    <span>{formatDateTime(channel.lastDeliveredAt)}</span>
                  </div>
                  <div
                    className="delivery-channel-row__cell delivery-channel-row__last-status"
                    data-label="Last status"
                  >
                    <WorkspaceStatusBadge
                      label={channel.lastDeliveryStatus ?? "never sent"}
                      tone={getDeliveryStatusTone(channel.lastDeliveryStatus)}
                    />
                    <small>
                      {channel.lastDeliveryMessage ?? "No delivery yet."}
                    </small>
                  </div>
                  <div className="delivery-channel-row__actions">
                    <Link
                      className="action-link delivery-console-action"
                      href="/workspace/digests"
                    >
                      Test channel
                    </Link>
                    <a
                      className="action-link delivery-console-action"
                      href="#delivery-logs"
                    >
                      View logs
                    </a>
                    <DeliveryChannelActions
                      channelId={channel.id}
                      enabled={channel.enabled}
                    />
                  </div>
                  <details className="delivery-channel-row__edit">
                    <summary>Edit channel</summary>
                    <DeliveryChannelForm channel={channel} />
                  </details>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">
            No delivery channel has been configured.
          </p>
        )}
      </section>

      <section
        id="delivery-logs"
        className="detail-panel delivery-console-panel"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">Delivery logs</p>
            <h2>Recent sends</h2>
            <p>
              Each send creates a log. Failed sends can be retried without
              changing the digest content.
            </p>
          </div>
        </div>

        {runs.length > 0 ? (
          <div
            className="delivery-table-scroll"
            role="region"
            aria-label="Delivery logs table"
          >
            <div className="delivery-log-table">
              <div className="delivery-log-table__head">
                <span>Time</span>
                <span>Digest date</span>
                <span>Channel</span>
                <span>Status</span>
                <span>HTTP</span>
                <span>Message</span>
                <span>Retry</span>
              </div>
              {runs.slice(0, 24).map((run) => (
                <article className="delivery-log-row" key={run.id}>
                  <span>{formatDateTime(run.finishedAt ?? run.startedAt)}</span>
                  <Link href={`/workspace/digests/${run.digestDate}`}>
                    {run.digestDate}
                  </Link>
                  <span>{run.channelName}</span>
                  <WorkspaceStatusBadge
                    label={run.status}
                    tone={getDeliveryStatusTone(run.status)}
                  />
                  <span>{run.responseStatus?.toString() ?? "n/a"}</span>
                  <span className="delivery-log-message">
                    {getRunMessage(run)}
                  </span>
                  <DeliveryRunActions runId={run.id} status={run.status} />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">
            No delivery runs have been recorded yet.
          </p>
        )}
      </section>

      <details className="delivery-audit-panel">
        <summary>Recent delivery events</summary>
        <WorkflowEventList
          events={recentDeliveryEvents}
          title="Audit trail"
          description="Low-weight audit trail for delivery send success and failure."
        />
      </details>
    </WorkspacePageShell>
  );
}
