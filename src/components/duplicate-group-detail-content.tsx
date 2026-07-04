import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { DuplicateGroupActions } from "@/components/duplicate-group-actions";
import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import {
  getDuplicateReasonLabel,
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import type {
  DuplicateGroup,
  DuplicateReason,
  ImportedCandidate
} from "@/types/content";

interface DuplicateGroupDetailContentProps {
  group: DuplicateGroup;
  candidates: ImportedCandidate[];
  reasonsByCandidateId: Record<string, DuplicateReason[]>;
}

function getStatusTone(status: DuplicateGroup["status"]) {
  if (status === "resolved") {
    return "success" as const;
  }

  if (status === "ignored") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export function DuplicateGroupDetailContent({
  group,
  candidates,
  reasonsByCandidateId
}: DuplicateGroupDetailContentProps) {
  const primaryCandidate =
    candidates.find((candidate) => candidate.id === group.primaryCandidateId) ??
    candidates[0];
  const convertedTechnologyId = candidates.find(
    (candidate) => candidate.convertedTechnologyId
  )?.convertedTechnologyId;

  return (
    <div className="candidate-review-page duplicate-review-page">
      <section className="detail-panel candidate-review-hero workspace-object-hero">
        <p className="eyebrow">Duplicate Review</p>
        <h1>{primaryCandidate?.originalTitle ?? group.id}</h1>
        <p className="candidate-detail-hero__summary">
          Review these imported candidates as one possible technology event.
          Select a primary candidate before converting to a Technology draft.
        </p>
        <div className="candidate-detail-hero__meta">
          <WorkspaceStatusBadge
            label={group.status}
            tone={getStatusTone(group.status)}
          />
          <span className="info-pill">
            {group.candidateIds.length} candidates
          </span>
          {group.reasons.map((reason) => (
            <span key={reason} className="info-pill info-pill--warning">
              {getDuplicateReasonLabel(reason)}
            </span>
          ))}
        </div>
        <DuplicateGroupActions
          groupId={group.id}
          primaryCandidateId={group.primaryCandidateId}
          status={group.status}
          candidates={candidates}
        />
      </section>

      <div className="candidate-review-layout">
        <div className="candidate-review-main">
          <section className="section-panel candidate-detail-section">
            <div className="section-heading">
              <div>
                <h2>Candidate comparison</h2>
                <p>
                  Compare title, source, date, summary, and status before
                  resolving the group.
                </p>
              </div>
            </div>
            <div className="candidate-duplicate-list duplicate-review-list">
              {candidates.map((candidate) => {
                const candidateReasons =
                  reasonsByCandidateId[candidate.id] ?? [];
                const isPrimary = candidate.id === group.primaryCandidateId;

                return (
                  <article
                    key={candidate.id}
                    className={`candidate-duplicate-item duplicate-review-item${
                      isPrimary ? " duplicate-review-item--primary" : ""
                    }`}
                  >
                    <div className="candidate-duplicate-item__meta">
                      {isPrimary ? (
                        <span className="info-pill info-pill--warning">
                          Primary
                        </span>
                      ) : null}
                      <ImportedCandidateStatusBadge
                        status={candidate.importStatus}
                      />
                      <span>{candidate.publisherName}</span>
                      <span>{candidate.publishDate}</span>
                      <span>
                        {getImportedCandidateSourceTypeLabel(
                          candidate.sourceType
                        )}
                      </span>
                    </div>
                    <h3>
                      <Link href={`/workspace/candidates/${candidate.id}`}>
                        {candidate.originalTitle}
                      </Link>
                    </h3>
                    <p>
                      {candidate.originalSummary ?? "No summary available."}
                    </p>
                    <div className="candidate-duplicate-item__meta">
                      <span>
                        Type:{" "}
                        {getImportedCandidateNormalizedTypeLabel(
                          candidate.normalizedType
                        )}
                      </span>
                      <a
                        href={candidate.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="detail-info-card__link"
                      >
                        Open source
                      </a>
                    </div>
                    <div className="candidate-duplicate-item__reasons">
                      {candidateReasons.map((reason) => (
                        <span
                          key={reason}
                          className="info-pill info-pill--subtle"
                        >
                          {getDuplicateReasonLabel(reason)}
                        </span>
                      ))}
                      {candidate.tags.map((tag) => (
                        <span key={tag} className="info-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="candidate-review-aside">
          <DetailInfoCard
            title="Group workflow"
            className="detail-info-card--compact"
            rows={[
              {
                label: "Group ID",
                value: group.id
              },
              {
                label: "Status",
                value: (
                  <WorkspaceStatusBadge
                    label={group.status}
                    tone={getStatusTone(group.status)}
                  />
                )
              },
              {
                label: "Primary candidate",
                value: (
                  <Link
                    href={`/workspace/candidates/${group.primaryCandidateId}`}
                    className="detail-info-card__link"
                  >
                    {group.primaryCandidateId}
                  </Link>
                )
              },
              {
                label: "Converted draft",
                value: convertedTechnologyId ? (
                  <Link
                    href={`/workspace/technologies/${convertedTechnologyId}`}
                    className="detail-info-card__link"
                  >
                    Open workspace record
                  </Link>
                ) : (
                  "No draft generated yet"
                )
              },
              {
                label: "Created",
                value: group.createdAt.slice(0, 10)
              },
              {
                label: "Updated",
                value: group.updatedAt.slice(0, 10)
              }
            ]}
          />

          <section className="section-panel candidate-detail-section">
            <h2>Conversion rule</h2>
            <p className="detail-copy">
              Resolved duplicate groups should convert only the primary
              candidate. Other candidates become additional source references on
              the generated Technology draft.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
