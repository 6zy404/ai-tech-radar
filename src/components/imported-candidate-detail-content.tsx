import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { ImportedCandidateReviewActions } from "@/components/imported-candidate-review-actions";
import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { WorkflowEventList } from "@/components/workflow-event-list";
import {
  getDuplicateReasonLabel,
  getImportedCandidateDuplicateLabel,
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import {
  getCandidateDraftConversionReadiness,
  type DuplicateComparisonItem
} from "@/lib/candidate-workflow";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel,
  getRankingSourceLabel
} from "@/lib/ranking-display";
import type {
  ExternalSource,
  ImportedCandidate,
  TechnologyPriorityRanking,
  WorkflowEvent
} from "@/types/content";

interface ImportedCandidateDetailContentProps {
  candidate: ImportedCandidate;
  duplicateComparisons: DuplicateComparisonItem[];
  source?: ExternalSource;
  ranking: TechnologyPriorityRanking;
  workflowEvents: WorkflowEvent[];
}

export function ImportedCandidateDetailContent({
  candidate,
  duplicateComparisons,
  source,
  ranking,
  workflowEvents
}: ImportedCandidateDetailContentProps) {
  const conversionReadiness = getCandidateDraftConversionReadiness(candidate.id);

  return (
    <div className="candidate-review-page">
      <section className="detail-panel candidate-review-hero workspace-object-hero">
        <p className="eyebrow">
          {getImportedCandidateSourceTypeLabel(candidate.sourceType)}
        </p>
        <h1>{candidate.originalTitle}</h1>
        {candidate.originalSummary ? (
          <p className="candidate-detail-hero__summary">
            {candidate.originalSummary}
          </p>
        ) : null}

        <div className="candidate-detail-hero__meta">
          <ImportedCandidateStatusBadge status={candidate.importStatus} />
          <span className="info-pill">
            {getImportedCandidateNormalizedTypeLabel(candidate.normalizedType)}
          </span>
          <span className="info-pill">{candidate.publisherName}</span>
          <span className="info-pill">{candidate.publishDate}</span>
          <span className="info-pill">
            {candidate.originalLanguage.toUpperCase()}
          </span>
          <span className={getPriorityLevelClass(ranking.priorityLevel)}>
            {getPriorityLevelLabel(ranking.priorityLevel)}
          </span>
          {candidate.relatedCandidateIds.length > 0 ? (
            <span className="info-pill info-pill--warning">
              {getImportedCandidateDuplicateLabel(candidate)}
            </span>
          ) : null}
        </div>

        <ImportedCandidateReviewActions
          candidateId={candidate.id}
          importStatus={candidate.importStatus}
          convertedTechnologyId={candidate.convertedTechnologyId}
          canConvert={conversionReadiness.canConvert}
          conversionBlockedMessage={conversionReadiness.message}
        />
      </section>

      <div className="candidate-review-layout">
        <div className="candidate-review-main">
          {candidate.originalContent ? (
            <section className="section-panel candidate-detail-section">
              <h2>Original content</h2>
              <p className="detail-copy">{candidate.originalContent}</p>
            </section>
          ) : null}

          {duplicateComparisons.length > 0 ? (
            <section className="section-panel candidate-detail-section">
              <div className="section-heading">
                <div>
                  <h2>Possible duplicates</h2>
                  <p>
                    Compare likely duplicates before converting this item into a
                    workspace draft.
                  </p>
                </div>
                {candidate.duplicateGroupId ? (
                  <Link
                    href={`/workspace/duplicates/${candidate.duplicateGroupId}`}
                    className="action-link"
                  >
                    Review group
                  </Link>
                ) : null}
              </div>
              <div className="candidate-duplicate-list">
                {duplicateComparisons.map((comparison) => (
                  <article
                    key={comparison.candidate.id}
                    className="candidate-duplicate-item"
                  >
                    <div className="candidate-duplicate-item__meta">
                      <span>{comparison.candidate.publisherName}</span>
                      <span>{comparison.candidate.publishDate}</span>
                      <ImportedCandidateStatusBadge
                        status={comparison.candidate.importStatus}
                      />
                    </div>
                    <h3>
                      <Link href={`/workspace/candidates/${comparison.candidate.id}`}>
                        {comparison.candidate.originalTitle}
                      </Link>
                    </h3>
                    <p>{comparison.candidate.originalSummary ?? "No summary available."}</p>
                    <div className="candidate-duplicate-item__reasons">
                      {comparison.reasons.map((reason) => (
                        <span key={reason} className="info-pill info-pill--subtle">
                          {getDuplicateReasonLabel(reason)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="section-panel candidate-detail-section raw-payload-panel">
            <h2>Raw payload snapshot</h2>
            <div className="raw-payload-shell">
              <pre className="raw-payload">
                {JSON.stringify(candidate.rawPayload, null, 2)}
              </pre>
            </div>
          </section>

          <WorkflowEventList
            events={workflowEvents}
            title="Candidate workflow events"
            description="Recent internal state changes for this imported candidate."
          />
        </div>

        <aside className="candidate-review-aside">
          <DetailInfoCard
            title="Reference"
            className="detail-info-card--compact"
            rows={[
              {
                label: "Source",
                value: source ? (
                  <Link
                    href={`/workspace/sources/${source.id}`}
                    className="detail-info-card__link"
                  >
                    {candidate.sourceName}
                  </Link>
                ) : (
                  candidate.sourceName
                )
              },
              {
                label: "Source ID",
                value: candidate.sourceId ?? "No source ID"
              },
              {
                label: "Source type",
                value: getImportedCandidateSourceTypeLabel(candidate.sourceType)
              },
              {
                label: "Original source link",
                value: (
                  <div className="candidate-source-link">
                    <a
                      className="detail-info-card__link"
                      href={candidate.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original source
                    </a>
                    <span className="candidate-source-link__url">
                      {candidate.sourceUrl}
                    </span>
                  </div>
                )
              },
              {
                label: "Publisher",
                value: candidate.publisherName
              }
            ]}
          />

          <DetailInfoCard
            title="Review snapshot"
            className="detail-info-card--compact"
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
                label: "Reasons",
                value: ranking.priorityReasons.slice(0, 3).join(" ")
              },
              {
                label: "Warnings",
                value:
                  ranking.priorityWarnings.length > 0
                    ? ranking.priorityWarnings.slice(0, 3).join(" ")
                    : "No priority warnings"
              },
              {
                label: "Normalized type",
                value: getImportedCandidateNormalizedTypeLabel(
                  candidate.normalizedType
                )
              },
              {
                label: "Current status",
                value: <ImportedCandidateStatusBadge status={candidate.importStatus} />
              },
              {
                label: "Reviewed at",
                value: candidate.reviewedAt
                  ? candidate.reviewedAt.slice(0, 10)
                  : "Not reviewed yet"
              },
              {
                label: "Duplicate group",
                value: candidate.duplicateGroupId ? (
                  <Link
                    href={`/workspace/duplicates/${candidate.duplicateGroupId}`}
                    className="detail-info-card__link"
                  >
                    {candidate.duplicateGroupId}
                  </Link>
                ) : (
                  "No duplicate group"
                )
              },
              {
                label: "Workspace record",
                value: candidate.convertedTechnologyId ? (
                  <Link
                    href={`/workspace/technologies/${candidate.convertedTechnologyId}`}
                    className="detail-info-card__link"
                  >
                    Open generated workspace record
                  </Link>
                ) : (
                  "No workspace record generated yet"
                )
              },
              {
                label: "Tags",
                value: candidate.tags.length > 0 ? candidate.tags.join(", ") : "None"
              }
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
