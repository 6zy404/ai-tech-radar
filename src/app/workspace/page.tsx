import Link from "next/link";

import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getCandidateWorkflowData,
  getTechnologyWorkspaceRecords
} from "@/lib/candidate-workflow";
import { getDeliveryChannels, getDeliveryRuns } from "@/lib/delivery-workflow";
import { getDailyDigests } from "@/lib/digest-workflow";
import { getSystemHealthSummary } from "@/lib/operations-metrics";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "@/lib/scheduled-delivery-workflow";
import {
  getExternalSources,
  getLatestExternalSourceImportRun
} from "@/lib/source-workflow";

export const dynamic = "force-dynamic";

interface DashboardActivity {
  label: string;
  title: string;
  meta: string;
  href: string;
}

function parseTime(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function WorkspaceHomePage() {
  const { candidates, duplicateGroups, snapshot } = getCandidateWorkflowData();
  const sources = getExternalSources();
  const workspaceRecords = getTechnologyWorkspaceRecords();
  const digests = getDailyDigests();
  const deliveryChannels = getDeliveryChannels();
  const deliveryRuns = getDeliveryRuns();
  const deliverySchedules = getScheduledDeliveries();
  const scheduledRuns = getScheduledDeliveryRuns();
  const latestImportRun = getLatestExternalSourceImportRun();
  const operations = getSystemHealthSummary();

  const enabledSources = sources.filter((source) => source.enabled).length;
  const newCandidates = candidates.filter(
    (candidate) => candidate.importStatus === "new"
  ).length;
  const openDuplicateGroups = duplicateGroups.filter(
    (group) => group.status === "open"
  ).length;
  const draftRecords = workspaceRecords.filter(
    (record) => record.status === "draft"
  ).length;
  const publishedRecords = workspaceRecords.filter(
    (record) => record.status === "published"
  ).length;
  const digestDrafts = digests.filter((digest) => digest.status === "draft").length;
  const publishedDigests = digests.filter(
    (digest) => digest.status === "published"
  ).length;
  const enabledDeliveryChannels = deliveryChannels.filter(
    (channel) => channel.enabled
  ).length;
  const failedDeliveryRuns = deliveryRuns.filter(
    (run) => run.status === "failed"
  ).length;
  const enabledDeliverySchedules = deliverySchedules.filter(
    (schedule) => schedule.enabled
  ).length;

  const latestWorkspaceRecord = [...workspaceRecords].sort(
    (a, b) => parseTime(b.updatedAt) - parseTime(a.updatedAt)
  )[0];
  const latestDigest = [...digests].sort(
    (a, b) =>
      parseTime(b.updatedAt ?? b.generatedAt) -
      parseTime(a.updatedAt ?? a.generatedAt)
  )[0];
  const latestDeliveryRun = deliveryRuns[0];
  const latestScheduledRun = scheduledRuns[0];

  const recentActivity: DashboardActivity[] = [
    latestImportRun
      ? {
          label: "Latest batch import",
          title: latestImportRun.status,
          meta: `${latestImportRun.totalCandidatesCreated} created, ${latestImportRun.totalCandidatesSkipped} skipped · ${formatDateTime(
            latestImportRun.finishedAt
          )}`,
          href: "/workspace/sources"
        }
      : null,
    latestWorkspaceRecord
      ? {
          label: "Latest technology record",
          title: latestWorkspaceRecord.title.original || "Untitled technology record",
          meta: `${latestWorkspaceRecord.status} · ${formatDateTime(
            latestWorkspaceRecord.updatedAt
          )}`,
          href: `/workspace/technologies/${latestWorkspaceRecord.id}`
        }
      : null,
    latestDigest
      ? {
          label: "Latest digest",
          title: latestDigest.title || "Untitled digest",
          meta: `${latestDigest.status} · ${formatDateTime(latestDigest.updatedAt)}`,
          href: `/workspace/digests/${latestDigest.date}`
        }
      : null,
    latestDeliveryRun
      ? {
          label: "Latest delivery",
          title: latestDeliveryRun.channelName,
          meta: `${latestDeliveryRun.status} · ${formatDateTime(
            latestDeliveryRun.finishedAt ?? latestDeliveryRun.startedAt
          )}`,
          href: "/workspace/delivery"
        }
      : null,
    latestScheduledRun
      ? {
          label: "Latest scheduled delivery",
          title: latestScheduledRun.scheduleName,
          meta: `${latestScheduledRun.status} - ${formatDateTime(
            latestScheduledRun.finishedAt ?? latestScheduledRun.startedAt
          )}`,
          href: "/workspace/delivery/schedules"
        }
      : null
  ].filter((activity): activity is DashboardActivity => activity !== null);

  const workflowSteps = [
    {
      label: "Sources",
      href: "/workspace/sources",
      count: `${enabledSources}/${sources.length} enabled`,
      description: "Configure RSS, release, and official update sources."
    },
    {
      label: "Import",
      href: "/workspace/sources",
      count: latestImportRun ? latestImportRun.status : "not run",
      description: "Run enabled sources into the candidate pool."
    },
    {
      label: "Candidates",
      href: "/workspace/candidates",
      count: `${newCandidates} new`,
      description: "Review imported items before they become formal drafts."
    },
    {
      label: "Duplicates",
      href: "/workspace/duplicates",
      count: `${openDuplicateGroups} open`,
      description: "Pick primary candidates and keep duplicate sources as references."
    },
    {
      label: "Drafts",
      href: "/workspace/technologies",
      count: `${draftRecords} drafts`,
      description: "Edit formal technology records and run publish checks."
    },
    {
      label: "Publish",
      href: "/workspace/technologies",
      count: `${publishedRecords} published`,
      description: "Move ready technology records into the user-facing product."
    },
    {
      label: "Digests",
      href: "/workspace/digests",
      count: `${digestDrafts} drafts`,
      description: "Generate, edit, preview, and publish daily briefs."
    },
    {
      label: "Delivery",
      href: "/workspace/delivery",
      count: `${enabledDeliveryChannels} channels`,
      description: "Manually send published digests to configured channels."
    },
    {
      label: "Schedules",
      href: "/workspace/delivery/schedules",
      count: `${enabledDeliverySchedules} enabled`,
      description: "Run local scheduled delivery for published daily briefs."
    },
    {
      label: "Operations",
      href: "/workspace/operations",
      count: operations.status,
      description: "Inspect system health, failures, task runner state, and audit events."
    }
  ];

  const summaryCards = [
    { label: "Enabled sources", value: enabledSources, hint: `${sources.length} configured` },
    {
      label: "New candidates",
      value: newCandidates,
      hint: `${candidates.length} total imported`
    },
    {
      label: "Open duplicate groups",
      value: openDuplicateGroups,
      hint: `${duplicateGroups.length} total groups`
    },
    {
      label: "Drafts waiting",
      value: draftRecords,
      hint: `${workspaceRecords.length} workspace records`
    },
    {
      label: "Published technologies",
      value: publishedRecords,
      hint: "Visible to users"
    },
    {
      label: "Digest drafts",
      value: digestDrafts,
      hint: `${publishedDigests} published digests`
    },
    {
      label: "Delivery channels",
      value: enabledDeliveryChannels,
      hint: `${failedDeliveryRuns} failed delivery runs`
    },
    {
      label: "Delivery schedules",
      value: enabledDeliverySchedules,
      hint: `${scheduledRuns.length} scheduled runs`
    }
  ];

  const primaryActions = [
    {
      label: "Import enabled sources",
      href: "/workspace/sources",
      description: "Run the batch import control."
    },
    {
      label: "Review candidates",
      href: "/workspace/candidates",
      description: "Process new imported items."
    },
    {
      label: "Resolve duplicates",
      href: "/workspace/duplicates",
      description: "Choose primary candidates."
    },
    {
      label: "Edit drafts",
      href: "/workspace/technologies",
      description: "Prepare formal technology records."
    },
    {
      label: "Manage digests",
      href: "/workspace/digests",
      description: "Edit and publish daily briefs."
    },
    {
      label: "Open operations",
      href: "/workspace/operations",
      description: "Check failures, recent events, and system health."
    }
  ];

  return (
    <WorkspacePageShell
      title="Internal Editorial Workspace"
      description="Internal control surface for source import, candidate review, duplicate resolution, technology drafts, publication, digest editing, delivery, and operations."
      sectionLabel="Reviewer / Editor"
    >
      <section className="workspace-dashboard">
        <div className="workspace-dashboard__intro">
          <p className="eyebrow workspace-eyebrow">Internal workflow</p>
          <h2>Turn external technology signals into reviewed public content.</h2>
          <p>
            Imported data stays in the workspace until a reviewer checks source
            quality, duplicate groups, draft readiness, and digest publishing.
            The public product only receives published technology and digest content.
          </p>
        </div>

        <div className="workspace-status-summary" aria-label="Workspace status summary">
          {summaryCards.map((card) => (
            <article className="workspace-status-summary__card" key={card.label}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
              <small>{card.hint}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Operations summary</h2>
            <p>
              Lightweight health view for sources, delivery, scheduled runs,
              task runner state, and workflow events.
            </p>
          </div>
          <Link className="action-link" href="/workspace/operations">
            Open Operations
          </Link>
        </div>
        <div className="workspace-operations-summary">
          <article
            className={`workspace-operations-summary__card workspace-operations-summary__card--${operations.status}`}
          >
            <span>System health</span>
            <strong>{operations.status}</strong>
            <small>{operations.statusReasons[0]}</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>Attention required</span>
            <strong>{operations.attentionItems.length}</strong>
            <small>items currently visible</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>Failed deliveries</span>
            <strong>{operations.failedDeliveries.length}</strong>
            <small>delivery runs need review</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>Failed sources</span>
            <strong>{operations.failedImports.length}</strong>
            <small>source imports need review</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>Recent task runner</span>
            <strong>
              {operations.taskRunnerSummary.latestRun?.status ?? "not run"}
            </strong>
            <small>
              {operations.taskRunnerSummary.latestRun
                ? `${operations.taskRunnerSummary.latestRun.deliveryLogsCreated} delivery logs`
                : "no local runner record"}
            </small>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Workflow overview</h2>
          <p>Each step links to the workspace module responsible for that stage.</p>
        </div>
        <div className="workflow-overview" aria-label="Workspace workflow overview">
          {workflowSteps.map((step, index) => (
            <Link className="workflow-step" href={step.href} key={step.label}>
              <span className="workflow-step__index">{index + 1}</span>
              <span className="workflow-step__label">{step.label}</span>
              <strong>{step.count}</strong>
              <p>{step.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Primary actions</h2>
          <p>Start from the step that matches the work you need to do now.</p>
        </div>
        <div className="workspace-action-grid">
          {primaryActions.map((action) => (
            <Link className="workspace-action-card" href={action.href} key={action.label}>
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Recent activity</h2>
          <p>Only real local workflow records are shown here.</p>
        </div>
        {recentActivity.length > 0 ? (
          <div className="workspace-activity-list">
            {recentActivity.map((activity) => (
              <Link
                className="workspace-activity-card"
                href={activity.href}
                key={`${activity.label}-${activity.title}`}
              >
                <span>{activity.label}</span>
                <strong>{activity.title}</strong>
                <small>{activity.meta}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No import, draft, digest, or delivery activity has been recorded yet.
          </p>
        )}
      </section>

      <section className="section-block section-block--subtle">
        <div className="section-heading">
          <h2>Source snapshots</h2>
          <p>
            {snapshot.sources.length > 0
              ? `${snapshot.sources.length} imported source snapshots are available for candidate traceability.`
              : "No imported source snapshots are available yet."}
          </p>
        </div>
      </section>
    </WorkspacePageShell>
  );
}
