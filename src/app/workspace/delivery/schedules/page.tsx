import Link from "next/link";

import {
  RunDueSchedulesButton,
  ScheduledDeliveryActions
} from "@/components/scheduled-delivery-actions";
import { ScheduledDeliveryForm } from "@/components/scheduled-delivery-form";
import { MetadataRow } from "@/components/metadata-row";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
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
      title="Scheduled Delivery"
      description="Configure local schedules that send published Daily Digest records to enabled delivery channels. Schedules decide when to send; channels decide where to send."
      sectionLabel="Delivery / Schedules"
    >
      <WorkspaceListToolbar
        label={`${enabledCount}/${schedules.length} schedules enabled`}
        detail={`${dueCount} due now, ${runs.length} scheduled run(s) recorded.`}
      />

      <div className="delivery-workspace-layout">
        <main className="delivery-workspace-layout__main">
          <section className="detail-panel delivery-section">
            <div className="section-heading">
              <div>
                <h2>Schedules</h2>
                <p>
                  Each schedule selects a published digest target and sends it
                  to the configured channels at a local time. Disabled channels
                  are skipped during runs.
                </p>
              </div>
              <Link className="action-link" href="/workspace/delivery">
                Manage channels
              </Link>
            </div>

            <details className="workspace-drawer-lite">
              <summary>Create schedule</summary>
              <div className="workspace-drawer-lite__body">
                <p>
                  Keep schedules simple: one digest target, one local time, and
                  one or more delivery channels.
                </p>
                <ScheduledDeliveryForm channels={channels} />
              </div>
            </details>

            {schedules.length > 0 ? (
              <div className="delivery-channel-list">
                {schedules.map((schedule) => {
                  const channelLabels = schedule.channelIds.map((channelId) => {
                    const channel = channelById.get(channelId);

                    return channel
                      ? `${channel.name} (${getDeliveryChannelTypeLabel(
                          channel.type
                        )}, ${channel.enabled ? "enabled" : "disabled"})`
                      : `${channelId} (missing)`;
                  });

                  return (
                    <article className="delivery-channel-card" key={schedule.id}>
                      <div className="delivery-channel-card__header">
                        <div>
                          <h3>{schedule.name}</h3>
                          <p>
                            {getDigestTargetLabel(
                              schedule.digestTarget,
                              schedule.digestDate
                            )}{" "}
                            at {schedule.scheduleTime} {schedule.timezone}
                          </p>
                        </div>
                        <WorkspaceStatusBadge
                          label={schedule.enabled ? "enabled" : "disabled"}
                          tone={schedule.enabled ? "success" : "neutral"}
                        />
                      </div>

                      <MetadataRow
                        items={[
                          {
                            label: "Digest target",
                            value: getDigestTargetLabel(
                              schedule.digestTarget,
                              schedule.digestDate
                            )
                          },
                          {
                            label: "Next run",
                            value: formatDateTime(schedule.nextRunAt)
                          },
                          {
                            label: "Last run",
                            value: formatDateTime(schedule.lastRunAt)
                          },
                          {
                            label: "Last status",
                            value: schedule.lastRunStatus
                          }
                        ]}
                      />

                      <dl className="digest-delivery-list">
                        <div>
                          <dt>Channels</dt>
                          <dd>
                            {channelLabels.length > 0
                              ? channelLabels.join(", ")
                              : "No channels selected."}
                          </dd>
                        </div>
                        <div>
                          <dt>Last message</dt>
                          <dd>
                            {schedule.lastRunMessage ??
                              "This schedule has not run yet."}
                          </dd>
                        </div>
                      </dl>

                      <ScheduledDeliveryActions
                        scheduleId={schedule.id}
                        enabled={schedule.enabled}
                      />

                      <details className="delivery-channel-card__edit">
                        <summary>Edit schedule</summary>
                        <ScheduledDeliveryForm
                          schedule={schedule}
                          channels={channels}
                        />
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                No schedules have been configured. Create one after adding at
                least one delivery channel.
              </p>
            )}
          </section>

          <section className="detail-panel delivery-section">
            <div className="section-heading">
              <div>
                <h2>Recent scheduled runs</h2>
                <p>
                  A scheduled run groups the per-channel DeliveryLog records for
                  one schedule execution.
                </p>
              </div>
            </div>

            {runs.length > 0 ? (
              <div className="delivery-log-list">
                {runs.slice(0, 20).map((run) => (
                  <article className="delivery-log-card" key={run.id}>
                    <div className="delivery-log-card__header">
                      <div>
                        <strong>{run.scheduleName}</strong>
                        <span>
                          {run.digestDate ? `Digest ${run.digestDate}` : "No digest"} -{" "}
                          {run.triggerType}
                        </span>
                      </div>
                      <WorkspaceStatusBadge
                        label={run.status}
                        tone={getRunStatusTone(run.status)}
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
                          label: "Channels",
                          value: `${run.successfulChannels} success, ${run.failedChannels} failed, ${run.skippedChannels} skipped`
                        },
                        {
                          label: "Delivery logs",
                          value: run.deliveryLogIds.length.toString()
                        }
                      ]}
                    />
                    <p className="empty-state">{run.message}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                No scheduled delivery runs have been recorded yet.
              </p>
            )}
          </section>
        </main>

        <aside className="delivery-workspace-layout__aside">
          <section className="detail-panel delivery-section">
            <div className="section-heading">
              <div>
                <h2>Run due schedules now</h2>
                <p>
                  Executes every enabled schedule whose next run time is due.
                  This is the local runner entry point for v0.
                </p>
              </div>
            </div>
            <RunDueSchedulesButton disabled={schedules.length === 0} />
            {lastRun ? (
              <p className="empty-state">
                Latest run: {lastRun.status} - {formatDateTime(lastRun.finishedAt)}
              </p>
            ) : null}
          </section>

          <section className="detail-panel delivery-section">
            <h2>Task runner</h2>
            <p>
              Use the command line runner for local cron-style execution. It
              uses the same duplicate protection as the workspace button.
            </p>
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
          </section>

          <section className="detail-panel delivery-section">
            <h2>Current v0 rules</h2>
            <dl className="digest-delivery-list">
              <div>
                <dt>Digest safety</dt>
                <dd>Only published digests can be sent.</dd>
              </div>
              <div>
                <dt>Duplicate protection</dt>
                <dd>
                  Scheduled runs skip the same schedule / digest / channel on
                  the same local day. Manual runs are explicit force runs.
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
          </section>

          <WorkflowEventList
            events={recentScheduleEvents}
            title="Recent schedule events"
            description="Task runner and schedule execution audit trail."
          />
        </aside>
      </div>
    </WorkspacePageShell>
  );
}
