import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { ExternalSourceActions } from "@/components/external-source-actions";
import { ExternalSourceForm } from "@/components/external-source-form";
import { ExternalSourceStatusBadge } from "@/components/external-source-status-badge";
import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { getExternalSourceTypeLabel } from "@/lib/source-display";
import {
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import {
  formatQualityRate,
  getSourceQualityLevelClass,
  getSourceQualityLevelLabel
} from "@/lib/quality-display";
import type {
  ExternalSource,
  ImportedCandidate,
  SourceQualityMetrics
} from "@/types/content";

interface ExternalSourceDetailContentProps {
  source: ExternalSource;
  candidates: ImportedCandidate[];
  quality: SourceQualityMetrics;
}

export function ExternalSourceDetailContent({
  source,
  candidates,
  quality
}: ExternalSourceDetailContentProps) {
  return (
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-panel technology-detail-panel workspace-object-hero">
          <p className="eyebrow">External Source</p>
          <h1>{source.name}</h1>
          <p className="technology-detail-panel__summary">
            {source.description ??
              "Internal source configuration used to import external content into the candidate pool."}
          </p>
          <div className="candidate-detail-hero__meta">
            <span
              className={
                source.enabled ? "info-pill" : "info-pill info-pill--warning"
              }
            >
              {source.enabled ? "Enabled" : "Disabled"}
            </span>
            <span className="info-pill">
              {getExternalSourceTypeLabel(source.type)}
            </span>
            <span className="info-pill">{source.language.toUpperCase()}</span>
            <ExternalSourceStatusBadge status={source.lastImportStatus} />
            <span className={getSourceQualityLevelClass(quality.qualityLevel)}>
              Quality: {getSourceQualityLevelLabel(quality.qualityLevel)}
            </span>
          </div>
          <ExternalSourceActions
            sourceId={source.id}
            enabled={source.enabled}
          />
        </section>

        <section className="section-panel">
          <h2>Edit source</h2>
          <ExternalSourceForm source={source} />
        </section>

        <section className="section-panel candidate-detail-section">
          <h2>Recent imported candidates</h2>
          {candidates.length > 0 ? (
            <div className="candidate-duplicate-list">
              {candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="candidate-duplicate-item"
                >
                  <div className="candidate-duplicate-item__meta">
                    <span>
                      {getImportedCandidateSourceTypeLabel(
                        candidate.sourceType
                      )}
                    </span>
                    <span>{candidate.publishDate}</span>
                    <span>
                      Imported{" "}
                      {candidate.importedAt
                        ? candidate.importedAt.slice(0, 16).replace("T", " ")
                        : "before tracking"}
                    </span>
                    <ImportedCandidateStatusBadge
                      status={candidate.importStatus}
                    />
                  </div>
                  <h3>
                    <Link href={`/workspace/candidates/${candidate.id}`}>
                      {candidate.originalTitle}
                    </Link>
                  </h3>
                  <p>{candidate.originalSummary ?? "No summary available."}</p>
                  <div className="candidate-duplicate-item__reasons">
                    <span className="info-pill info-pill--subtle">
                      {getImportedCandidateNormalizedTypeLabel(
                        candidate.normalizedType
                      )}
                    </span>
                    {candidate.tags.map((tag) => (
                      <span key={tag} className="info-pill info-pill--subtle">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              No candidates are currently linked to this source. Run source
              import to create candidate records.
            </p>
          )}
        </section>
      </div>

      <aside className="detail-side">
        <DetailInfoCard
          title="Source config"
          rows={[
            {
              label: "Type",
              value: getExternalSourceTypeLabel(source.type)
            },
            {
              label: "URL",
              value: (
                <a
                  className="detail-info-card__link"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.url}
                </a>
              )
            },
            {
              label: "Publisher",
              value: source.publisherName ?? "No publisher"
            },
            {
              label: "Publisher type",
              value: source.publisherType
            },
            {
              label: "Default type",
              value: source.defaultNormalizedType
            },
            {
              label: "Default tags",
              value:
                source.defaultTags.length > 0
                  ? source.defaultTags.join(", ")
                  : "None"
            }
          ]}
        />

        <DetailInfoCard
          title="Latest import"
          rows={[
            {
              label: "Status",
              value: (
                <ExternalSourceStatusBadge status={source.lastImportStatus} />
              )
            },
            {
              label: "Fetched at",
              value: source.lastFetchedAt
                ? source.lastFetchedAt.slice(0, 16).replace("T", " ")
                : "Never fetched"
            },
            {
              label: "Last count",
              value: String(source.lastImportCount ?? 0)
            },
            {
              label: "Failures",
              value: String(source.consecutiveFailureCount ?? 0)
            },
            {
              label: "Total imported",
              value: String(source.totalImportedCount ?? 0)
            },
            {
              label: "Last success",
              value: source.lastSuccessfulImportAt
                ? source.lastSuccessfulImportAt.slice(0, 16).replace("T", " ")
                : "No successful import yet"
            },
            {
              label: "Message",
              value: source.lastImportMessage ?? "No import has run yet"
            },
            {
              label: "Last error",
              value: source.lastErrorMessage ?? "No recent error"
            },
            {
              label: "Candidate count",
              value: String(candidates.length)
            }
          ]}
        />

        <DetailInfoCard
          title="Source quality"
          rows={[
            {
              label: "Quality level",
              value: (
                <span
                  className={getSourceQualityLevelClass(quality.qualityLevel)}
                >
                  {getSourceQualityLevelLabel(quality.qualityLevel)}
                </span>
              )
            },
            {
              label: "Success rate",
              value: `${formatQualityRate(quality.successRate)} (${quality.successfulImportRuns}/${quality.totalImportRuns})`
            },
            {
              label: "Duplicate rate",
              value: `${formatQualityRate(quality.duplicateRate)} (${quality.duplicateCandidateCount}/${quality.totalCandidatesImported})`
            },
            {
              label: "Conversion rate",
              value: `${formatQualityRate(quality.conversionRate)} (${quality.convertedCandidateCount}/${quality.totalCandidatesImported})`
            },
            {
              label: "Rejection rate",
              value: `${formatQualityRate(quality.rejectionRate)} (${quality.rejectedCandidateCount}/${quality.totalCandidatesImported})`
            },
            {
              label: "Failed runs",
              value: String(quality.failedImportRuns)
            },
            {
              label: "Consecutive failures",
              value: String(quality.consecutiveFailureCount)
            }
          ]}
        />
      </aside>
    </div>
  );
}
