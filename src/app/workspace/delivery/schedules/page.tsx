import Link from "next/link";

import {
  RunDueSchedulesButton,
  ScheduledDeliveryActions
} from "@/components/scheduled-delivery-actions";
import { ScheduledDeliveryForm } from "@/components/scheduled-delivery-form";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { getDeliveryChannels } from "@/lib/delivery-workflow";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "@/lib/scheduled-delivery-workflow";
import { getLatestTaskRunnerRun } from "@/lib/task-runner";
import { getRecentWorkflowEvents } from "@/lib/workflow-events";
import type { ScheduledDeliveryRunStatus } from "@/types/content";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en");
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
    return digestDate ? `Digest ${digestDate}` : "Digest by date";
  }

  return "Latest published digest";
}

export default function WorkspaceDeliverySchedulesPage() {
  const channels = getDeliveryChannels();
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const schedules = getScheduledDeliveries();
  const runs = getScheduledDeliveryRuns();
  const latestTaskRunnerRun = getLatestTaskRunnerRun();
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
      title="Scheduled Delivery"
      description="Manage local schedules for sending published Daily Digest records to enabled delivery channels."
      sectionLabel="Delivery / Schedules"
      actions={
        <a className="action-button action-button--accent" href="#create-schedule">
          Create schedule
        </a>
      }
      securityNote={
        <>
          <strong>Internal workspace</strong> - schedules trigger delivery
          channels; keep one task runner active per data directory.
        </>
      }
    >
      <section className="delivery-console-summary" aria-label="Schedule summary">
        <article className="delivery-console-summary__card">
          <span>Total schedules</span>
          <strong>{schedules.length}</strong>
          <p>{enabledCount} enabled</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>Due now</span>
          <strong>{dueCount}</strong>
          <p>{schedules.length - enabledCount} disabled</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>Last run</span>
          <strong>{lastRun?.status ?? "never run"}</strong>
          <p>{formatDateTime(lastRun?.finishedAt ?? lastRun?.startedAt)}</p>
        </article>
        <article className="delivery-console-summary__card">
          <span>Failed runs</span>
          <strong>{failedRunCount}</strong>
          <p>{runs.length} scheduled run records</p>
        </article>
      </section>

      <section
        id="delivery-schedules"
        className="detail-panel delivery-console-panel"
      >
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">Delivery schedules</p>
            <h2>Configured schedules</h2>
            <p>
              Schedules decide when to send. Channels decide where to send.
              Disabled schedules and disabled channels are skipped.
            </p>
          </div>
          <Link className="action-link" href="/workspace/delivery">
            Manage channels
          </Link>
        </div>

        <section
          id="create-schedule"
          className="delivery-create-panel schedule-create-panel"
          aria-label="Create delivery schedule"
        >
          <div className="delivery-create-panel__summary">
            <div>
              <h3>Create schedule</h3>
              <p>
                Use one digest target, one local time, and one or more enabled
                channels. The form is hidden until this section is opened.
              </p>
            </div>
            <a className="action-link" href="#delivery-schedules">
              Close form
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
            aria-label="Scheduled deliveries table"
          >
            <div className="schedule-table schedule-table--console">
              <div className="schedule-table__head">
                <span>Name</span>
                <span>Target</span>
                <span>Time</span>
                <span>Channels</span>
                <span>State</span>
                <span>Last run</span>
                <span>Next run</span>
                <span>Actions</span>
              </div>
              {schedules.map((schedule) => {
                const channelNames = schedule.channelIds.map((channelId) => {
                  const channel = channelById.get(channelId);

                  return channel ? channel.name : `${channelId} (missing)`;
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
                  `${schedule.channelIds.length} selected`,
                  disabledChannelCount
                    ? `${disabledChannelCount} disabled`
                    : null,
                  missingChannelCount ? `${missingChannelCount} missing` : null
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <article className="schedule-row" key={schedule.id}>
                    <div className="schedule-row__identity">
                      <strong>{schedule.name}</strong>
                      <p>{schedule.lastRunMessage ?? "No run message yet."}</p>
                    </div>
                    <div className="schedule-cell" data-label="Target">
                      <span>
                        {getDigestTargetLabel(
                          schedule.digestTarget,
                          schedule.digestDate
                        )}
                      </span>
                    </div>
                    <div className="schedule-cell" data-label="Time">
                      <span>{schedule.scheduleTime}</span>
                      <small>{schedule.timezone}</small>
                    </div>
                    <div className="schedule-cell" data-label="Channels">
                      <span>{channelSummary || "No channels"}</span>
                      <small>
                        {channelNames.length > 0
                          ? `${channelNames.slice(0, 2).join(", ")}${
                              channelNames.length > 2
                                ? ` +${channelNames.length - 2}`
                                : ""
                            }`
                          : "None selected"}
                      </small>
                    </div>
                    <div className="schedule-cell" data-label="State">
                      <WorkspaceStatusBadge
                        label={schedule.enabled ? "enabled" : "disabled"}
                        tone={schedule.enabled ? "success" : "neutral"}
                      />
                    </div>
                    <div className="schedule-cell" data-label="Last run">
                      <WorkspaceStatusBadge
                        label={schedule.lastRunStatus}
                        tone={getRunStatusTone(schedule.lastRunStatus)}
                      />
                      <small>{formatDateTime(schedule.lastRunAt)}</small>
                    </div>
                    <div className="schedule-cell" data-label="Next run">
                      <span>{formatDateTime(schedule.nextRunAt)}</span>
                    </div>
                    <div className="schedule-row__actions">
                      <ScheduledDeliveryActions
                        scheduleId={schedule.id}
                        enabled={schedule.enabled}
                      />
                      <details className="schedule-row__edit">
                        <summary>Edit</summary>
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
            <h3>No schedules yet</h3>
            <p>
              Create a schedule after adding at least one delivery channel. A
              schedule only sends published digests and skips disabled channels.
            </p>
            <a className="action-link" href="#create-schedule">
              Open create schedule form
            </a>
          </div>
        )}
      </section>

      <section className="detail-panel delivery-console-panel schedule-runs-panel">
        <div className="delivery-console-panel__header">
          <div>
            <p className="section-eyebrow">Scheduled runs</p>
            <h2>Recent executions</h2>
            <p>
              Each run groups the per-channel DeliveryLog records for one
              schedule execution.
            </p>
          </div>
        </div>

        {runs.length > 0 ? (
          <div
            className="delivery-table-scroll"
            role="region"
            aria-label="Scheduled delivery runs table"
          >
            <div className="schedule-run-table">
              <div className="schedule-run-table__head">
                <span>Time</span>
                <span>Schedule</span>
                <span>Digest</span>
                <span>Status</span>
                <span>Channels</span>
                <span>Trigger</span>
                <span>Message</span>
              </div>
              {runs.slice(0, 20).map((run) => (
                <article className="schedule-run-row" key={run.id}>
                  <span>{formatDateTime(run.finishedAt ?? run.startedAt)}</span>
                  <strong>{run.scheduleName}</strong>
                  <span>{run.digestDate ? `Digest ${run.digestDate}` : "No digest"}</span>
                  <WorkspaceStatusBadge
                    label={run.status}
                    tone={getRunStatusTone(run.status)}
                  />
                  <span>
                    {run.successfulChannels} success, {run.failedChannels} failed,{" "}
                    {run.skippedChannels} skipped
                  </span>
                  <span>{run.triggerType}</span>
                  <span className="delivery-log-message">{run.message}</span>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">
            No scheduled delivery runs have been recorded yet.
          </p>
        )}
      </section>

      <section className="schedule-support-grid" aria-label="Schedule support">
        <details className="schedule-support-panel">
          <summary>Task runner and due runs</summary>
          <p>
            The CLI runner uses the same duplicate protection as this workspace
            page.
          </p>
          <RunDueSchedulesButton disabled={dueCount === 0} />
          <dl className="digest-delivery-list">
            <div>
              <dt>Run once</dt>
              <dd>
                <code>npm run tasks:run-once</code>
              </dd>
            </div>
            <div>
              <dt>Watch mode</dt>
              <dd>
                <code>npm run tasks:watch</code>
              </dd>
            </div>
            <div>
              <dt>Latest task runner result</dt>
              <dd>
                {latestTaskRunnerRun
                  ? `${latestTaskRunnerRun.status} - ${latestTaskRunnerRun.dueScheduleCount} due, ${latestTaskRunnerRun.deliveryLogsCreated} delivery logs - ${formatDateTime(
                      latestTaskRunnerRun.finishedAt
                    )}`
                  : "No task runner execution has been recorded yet."}
              </dd>
            </div>
          </dl>
        </details>

        <details className="schedule-support-panel">
          <summary>Current v0 rules</summary>
          <dl className="digest-delivery-list">
            <div>
              <dt>Digest safety</dt>
              <dd>Only published digests can be sent.</dd>
            </div>
            <div>
              <dt>Duplicate protection</dt>
              <dd>
                Scheduled runs skip the same schedule / digest / channel on the
                same local day. Manual runs are explicit force runs.
              </dd>
            </div>
            <div>
              <dt>Failure handling</dt>
              <dd>
                One failed channel records a failed delivery log but does not
                stop other channels.
              </dd>
            </div>
          </dl>
        </details>

        <details className="schedule-support-panel">
          <summary>Recent schedule events</summary>
          <WorkflowEventList
            events={recentScheduleEvents}
            title="Audit trail"
            description="Task runner and schedule execution events."
          />
        </details>
      </section>
    </WorkspacePageShell>
  );
}
