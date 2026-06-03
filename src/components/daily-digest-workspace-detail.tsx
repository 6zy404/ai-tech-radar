import Link from "next/link";

import { DigestDeliveryActions } from "@/components/digest-delivery-actions";
import {
  DailyDigestEditForm,
  DailyDigestItemActions,
  DailyDigestManualAdd
} from "@/components/daily-digest-editor-actions";
import { DailyDigestStatusActions } from "@/components/daily-digest-workspace-actions";
import { DeliveryRunActions } from "@/components/delivery-run-actions";
import { DetailInfoCard } from "@/components/detail-info-card";
import { MetadataRow } from "@/components/metadata-row";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import {
  buildDigestShareText,
  getDeliverySurfaceUrls,
  getDigestPublicUrl,
  jsonFeedPath,
  rssFeedPath
} from "@/lib/digest-delivery";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel
} from "@/lib/ranking-display";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryRun,
  DigestPublishReadiness,
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  WorkflowEvent
} from "@/types/content";

interface DailyDigestWorkspaceDetailProps {
  digest: DailyDigest;
  readiness: DigestPublishReadiness;
  highPriorityTechnologies: TechnologyItem[];
  watchTechnologies: TechnologyItem[];
  availableTechnologies: TechnologyItem[];
  deliveryChannels: DeliveryChannel[];
  deliveryRuns: DeliveryRun[];
  skills: SkillItem[];
  knowledge: KnowledgeItem[];
  workflowEvents: WorkflowEvent[];
}

function getStatusTone(status: DailyDigest["status"]) {
  if (status === "published") {
    return "success" as const;
  }

  if (status === "archived") {
    return "neutral" as const;
  }

  return "warning" as const;
}

function WorkspaceDigestTechnologyList({
  title,
  description,
  digest,
  technologies
}: {
  title: string;
  description: string;
  digest: DailyDigest;
  technologies: TechnologyItem[];
}) {
  const pinnedIds = new Set(digest.pinnedTechnologyIds);

  return (
    <section className="detail-panel digest-workspace-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {technologies.length > 0 ? (
        <div className="digest-workspace-technology-list">
          {technologies.map((technology) => {
            const ranking = evaluateTechnologyPriority(technology);
            const isPinned = pinnedIds.has(technology.id);

            return (
              <article key={technology.id} className="digest-workspace-technology">
                <div className="digest-workspace-technology__header">
                  <span className={getPriorityLevelClass(ranking.priorityLevel)}>
                    {getPriorityLevelLabel(ranking.priorityLevel)}
                  </span>
                  {isPinned ? (
                    <span className="info-pill info-pill--success">Pinned</span>
                  ) : null}
                  {digest.manuallyAddedTechnologyIds.includes(technology.id) ? (
                    <span className="info-pill info-pill--subtle">Manual add</span>
                  ) : null}
                  <MetadataRow
                    items={[
                      { value: technology.sourceName },
                      { value: technology.publishDate }
                    ]}
                  />
                </div>
                <h3>
                  <Link href={`/technologies/${technology.slug}`}>
                    {getPreferredTechnologyTitle(technology)}
                  </Link>
                </h3>
                <p>{ranking.priorityReasons.slice(0, 3).join(" ")}</p>
                <DailyDigestItemActions
                  date={digest.date}
                  technologyId={technology.id}
                  isPinned={isPinned}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">No technologies selected in this section.</p>
      )}
    </section>
  );
}

function PublishReadinessPanel({
  readiness
}: {
  readiness: DigestPublishReadiness;
}) {
  return (
    <section className="detail-panel digest-readiness-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Publish Readiness</p>
          <h2>{readiness.isReady ? "Ready to publish" : "Blocked"}</h2>
          <p>
            Blocking errors stop publication. Warnings are allowed, but should
            be reviewed before publishing.
          </p>
        </div>
      </div>

      {readiness.blockingErrors.length > 0 ? (
        <div className="digest-readiness-list digest-readiness-list--blocking">
          <strong>Blocking errors</strong>
          <ul>
            {readiness.blockingErrors.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="digest-readiness-ok">No blocking errors.</p>
      )}

      {readiness.warnings.length > 0 ? (
        <div className="digest-readiness-list">
          <strong>Warnings</strong>
          <ul>
            {readiness.warnings.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="empty-state">No warnings.</p>
      )}
    </section>
  );
}

function DigestDeliveryPanel({ digest }: { digest: DailyDigest }) {
  const isPublished = digest.status === "published";
  const publicDigestUrl = getDigestPublicUrl(digest.date);
  const { rssFeedUrl, jsonFeedUrl } = getDeliverySurfaceUrls();

  return (
    <section className="detail-panel digest-delivery-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Delivery</p>
          <h2>{isPublished ? "Publicly delivered" : "Not publicly delivered yet"}</h2>
          <p>
            Delivery surfaces are generated from published digest records only.
          </p>
        </div>
      </div>

      <dl className="digest-delivery-list">
        <div>
          <dt>Status</dt>
          <dd>
            <span
              className={`info-pill ${
                isPublished ? "info-pill--success" : "info-pill--warning"
              }`}
            >
              {isPublished ? "Published" : "Workspace only"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{digest.updatedAt.slice(0, 16)}</dd>
        </div>
        {isPublished ? (
          <>
            <div>
              <dt>Public digest URL</dt>
              <dd>
                <Link href={`/digest/${digest.date}`} className="delivery-url">
                  {publicDigestUrl}
                </Link>
              </dd>
            </div>
            <div>
              <dt>RSS feed URL</dt>
              <dd>
                <Link href={rssFeedPath} className="delivery-url">
                  {rssFeedUrl}
                </Link>
              </dd>
            </div>
            <div>
              <dt>JSON feed URL</dt>
              <dd>
                <Link href={jsonFeedPath} className="delivery-url">
                  {jsonFeedUrl}
                </Link>
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>Public links</dt>
            <dd>Publish this digest before public feed and share links are shown.</dd>
          </div>
        )}
      </dl>

      <div className="digest-share-panel">
        <h3>Share text preview</h3>
        {isPublished ? (
          <textarea
            className="digest-share-preview"
            readOnly
            value={buildDigestShareText(digest)}
            aria-label="Digest share text preview"
          />
        ) : (
          <p className="empty-state">
            Not publicly delivered yet. Publish this digest to generate share
            text with the public URL.
          </p>
        )}
      </div>
    </section>
  );
}

function DigestDeliveryLogPanel({ runs }: { runs: DeliveryRun[] }) {
  return (
    <section className="detail-panel digest-delivery-log-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Delivery Logs</p>
          <h2>Recent sends</h2>
          <p>Manual delivery sends for this digest only.</p>
        </div>
      </div>

      {runs.length > 0 ? (
        <div className="digest-delivery-log-list">
          {runs.slice(0, 5).map((run) => (
            <article className="digest-delivery-log" key={run.id}>
              <div className="digest-delivery-log__header">
                <strong>
                  {run.channelName} · {getDeliveryChannelTypeLabel(run.channelType)}
                </strong>
                <WorkspaceStatusBadge
                  label={run.status}
                  tone={
                    run.status === "success"
                      ? "success"
                      : run.status === "failed"
                        ? "danger"
                        : "warning"
                  }
                />
              </div>
              <MetadataRow
                items={[
                  { label: "Started", value: run.startedAt.slice(0, 16) },
                  { label: "HTTP", value: run.responseStatus?.toString() ?? "n/a" }
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
        <p className="empty-state">No delivery send has been attempted yet.</p>
      )}
    </section>
  );
}

export function DailyDigestWorkspaceDetail({
  digest,
  readiness,
  highPriorityTechnologies,
  watchTechnologies,
  availableTechnologies,
  deliveryChannels,
  deliveryRuns,
  skills,
  knowledge,
  workflowEvents
}: DailyDigestWorkspaceDetailProps) {
  return (
    <div className="candidate-review-layout digest-workspace-detail">
      <main className="candidate-review-layout__main">
        <section className="workspace-object-hero">
          <div>
            <p className="eyebrow">Digest Review</p>
            <h1>{digest.title}</h1>
            <p>{digest.editorialSummary || digest.summary}</p>
            <MetadataRow
              items={[
                { label: "Date", value: digest.date },
                { label: "Generated", value: digest.generatedAt.slice(0, 16) },
                { label: "Updated", value: digest.updatedAt.slice(0, 16) },
                {
                  label: "Regenerated",
                  value: digest.lastRegeneratedAt?.slice(0, 16)
                },
                { label: "Published", value: digest.publishedAt?.slice(0, 16) }
              ]}
            />
          </div>
          <WorkspaceStatusBadge
            label={digest.status}
            tone={getStatusTone(digest.status)}
          />
        </section>

        <DailyDigestStatusActions
          date={digest.date}
          status={digest.status}
          readiness={readiness}
        />

        <DailyDigestEditForm digest={digest} />

        <PublishReadinessPanel readiness={readiness} />

        <WorkspaceDigestTechnologyList
          title="Immediate attention"
          description="High-priority ranking results plus manually pinned high-priority items."
          digest={digest}
          technologies={highPriorityTechnologies}
        />

        <WorkspaceDigestTechnologyList
          title="Worth tracking"
          description="Watch-level ranking results and manually added items that are not high priority."
          digest={digest}
          technologies={watchTechnologies}
        />

        <WorkflowEventList
          events={workflowEvents}
          title="Digest workflow events"
          description="Recent generation, edit, publish, and delivery-related events for this digest."
        />
      </main>

      <aside className="candidate-review-layout__aside">
        <DigestDeliveryPanel digest={digest} />

        <DigestDeliveryActions
          digestDate={digest.date}
          digestStatus={digest.status}
          channels={deliveryChannels}
        />

        <DigestDeliveryLogPanel runs={deliveryRuns} />

        <DetailInfoCard
          title="Digest structure"
          rows={[
            {
              label: "High priority",
              value: highPriorityTechnologies.length
            },
            { label: "Watch", value: watchTechnologies.length },
            { label: "Manual add", value: digest.manuallyAddedTechnologyIds.length },
            { label: "Excluded", value: digest.excludedTechnologyIds.length },
            { label: "Pinned", value: digest.pinnedTechnologyIds.length },
            { label: "Skills", value: skills.length },
            { label: "Knowledge", value: knowledge.length },
            { label: "Sources", value: digest.sourceNames.length }
          ]}
        />

        <DetailInfoCard
          title="Regenerate behavior"
          rows={[
            {
              label: "Rule",
              value:
                "Regenerate refreshes ranking-based sections while preserving manual add, exclude, pin, order, and editorial summary."
            },
            {
              label: "Editorial notes",
              value: digest.editorialNotes.join(" ")
            }
          ]}
        />

        <DailyDigestManualAdd
          date={digest.date}
          technologies={availableTechnologies}
        />

        <section className="detail-panel">
          <h2>Preview</h2>
          <div className="digest-workspace-card__links">
            <Link
              href={`/workspace/digests/${digest.date}/preview`}
              className="action-link"
            >
              Preview user-facing digest
            </Link>
            {digest.status === "published" ? (
              <Link href={`/digest/${digest.date}`} className="action-link">
                Open published digest
              </Link>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}
