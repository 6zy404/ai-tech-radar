import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { PublishReadinessPanel } from "@/components/publish-readiness-panel";
import { TechnologyEditorialEnrichmentPanel } from "@/components/technology-editorial-enrichment-panel";
import { TechnologyWorkspaceActions } from "@/components/technology-workspace-actions";
import { TechnologyWorkspaceEditForm } from "@/components/technology-workspace-edit-form";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import type { PublishReadinessResult } from "@/lib/publish-readiness";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel,
  getRankingSourceLabel
} from "@/lib/ranking-display";
import type {
  KnowledgeItem,
  EditorialEnrichmentSuggestion,
  SkillItem,
  TechnologyDraft,
  TopicTag,
  WorkflowEvent
} from "@/types/content";

interface TechnologyDraftDetailContentProps {
  draft: TechnologyDraft;
  tagOptions: TopicTag[];
  skillOptions: SkillItem[];
  knowledgeOptions: KnowledgeItem[];
  readiness: PublishReadinessResult;
  workflowEvents: WorkflowEvent[];
  enrichmentSuggestions: EditorialEnrichmentSuggestion[];
}

function getDraftDisplayTitle(draft: TechnologyDraft): string {
  return draft.title.zh ?? draft.title.original;
}

function getStatusTone(
  status: TechnologyDraft["status"]
): "neutral" | "success" | "warning" {
  if (status === "published") {
    return "success";
  }

  if (status === "archived") {
    return "warning";
  }

  return "neutral";
}

export function TechnologyDraftDetailContent({
  draft,
  tagOptions,
  skillOptions,
  knowledgeOptions,
  readiness,
  workflowEvents,
  enrichmentSuggestions
}: TechnologyDraftDetailContentProps) {
  const ranking = evaluateTechnologyPriority(draft);

  return (
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-panel technology-detail-panel workspace-object-hero">
          <p className="eyebrow">Technology Workspace</p>
          <h1>{getDraftDisplayTitle(draft)}</h1>
          <p className="technology-detail-panel__summary">
            {draft.summary.zh ?? draft.summary.original}
          </p>
          <p className="translation-note">
            This record was generated from an imported candidate and stays
            inside the internal workspace until it is published for end users.
          </p>
          <div className="candidate-detail-hero__meta">
            <WorkspaceStatusBadge
              label={draft.status}
              tone={getStatusTone(draft.status)}
            />
            <span className="info-pill">
              {draft.sourceLanguage.toUpperCase()}
            </span>
            <span className="info-pill">{draft.translationStatus}</span>
            <span className={getPriorityLevelClass(ranking.priorityLevel)}>
              {getPriorityLevelLabel(ranking.priorityLevel)}
            </span>
          </div>
          <TechnologyWorkspaceActions
            recordId={draft.id}
            status={draft.status}
            readiness={readiness}
          />
        </section>

        <PublishReadinessPanel readiness={readiness} />

        <TechnologyEditorialEnrichmentPanel
          record={draft}
          suggestions={enrichmentSuggestions}
        />

        <section className="section-panel technology-detail-panel__content">
          <h2>Record content</h2>
          <p className="detail-copy">
            {draft.content.zh ?? draft.content.original}
          </p>
        </section>

        <section className="section-panel">
          <h2>Editorial notes</h2>
          <ul className="relation-list">
            {draft.editorialNotes.map((note) => (
              <li key={note} className="relation-list__item">
                <div>
                  <p>{note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="section-panel">
          <TechnologyWorkspaceEditForm
            record={draft}
            tagOptions={tagOptions}
            skillOptions={skillOptions}
            knowledgeOptions={knowledgeOptions}
          />
        </section>

        <WorkflowEventList
          events={workflowEvents}
          title="Draft workflow events"
          description="Recent publish, edit, and conversion events for this workspace record."
        />
      </div>

      <aside className="detail-side">
        <DetailInfoCard
          title="Draft reference"
          rows={[
            {
              label: "Priority",
              value: (
                <span className={getPriorityLevelClass(ranking.priorityLevel)}>
                  {getPriorityLevelLabel(ranking.priorityLevel)}
                </span>
              )
            },
            {
              label: "Ranking source",
              value: getRankingSourceLabel(ranking.rankingSource)
            },
            {
              label: "Priority reasons",
              value: ranking.priorityReasons.slice(0, 3).join(" ")
            },
            {
              label: "Priority warnings",
              value:
                ranking.priorityWarnings.length > 0
                  ? ranking.priorityWarnings.slice(0, 3).join(" ")
                  : "No priority warnings"
            },
            {
              label: "Source candidate",
              value: draft.sourceCandidateId ? (
                <Link
                  href={`/workspace/candidates/${draft.sourceCandidateId}`}
                  className="detail-info-card__link"
                >
                  Open imported candidate
                </Link>
              ) : (
                "No source candidate link"
              )
            },
            {
              label: "Status",
              value: draft.status
            },
            {
              label: "User-facing page",
              value:
                draft.status === "published" ? (
                  <Link
                    href={`/technologies/${draft.slug}`}
                    className="detail-info-card__link"
                  >
                    Open published technology page
                  </Link>
                ) : (
                  "Not visible in the user-facing product yet"
                )
            },
            {
              label: "Preview",
              value: (
                <Link
                  href={`/workspace/technologies/${draft.id}/preview`}
                  className="detail-info-card__link"
                >
                  Open user-facing preview
                </Link>
              )
            },
            {
              label: "Source",
              value: draft.sourceName
            },
            {
              label: "Source URL",
              value: (
                <a
                  className="detail-info-card__link"
                  href={draft.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {draft.sourceUrl}
                </a>
              )
            },
            {
              label: "Additional references",
              value:
                draft.sourceReferences && draft.sourceReferences.length > 0 ? (
                  <div className="candidate-source-link">
                    {draft.sourceReferences.map((reference) => (
                      <Link
                        key={`${reference.candidateId}-${reference.sourceUrl}`}
                        href={`/workspace/candidates/${reference.candidateId}`}
                        className="detail-info-card__link"
                      >
                        {reference.sourceName}
                      </Link>
                    ))}
                  </div>
                ) : (
                  "No additional duplicate references"
                )
            },
            {
              label: "Type",
              value: draft.type
            },
            {
              label: "Publisher",
              value: draft.publisherName
            },
            {
              label: "Language",
              value: draft.sourceLanguage.toUpperCase()
            },
            {
              label: "Translation status",
              value: draft.translationStatus
            },
            {
              label: "Tags",
              value: draft.tags.length > 0 ? draft.tags.join(", ") : "None"
            },
            {
              label: "Updated",
              value: draft.updatedAt.slice(0, 10)
            }
          ]}
        />
      </aside>
    </div>
  );
}
