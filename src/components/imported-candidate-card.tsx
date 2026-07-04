import Link from "next/link";

import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import {
  getImportedCandidateDuplicateLabel,
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidatePreviewText,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import {
  getCandidateQualityFlagClass,
  getCandidateQualityFlagLabel
} from "@/lib/quality-display";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel
} from "@/lib/ranking-display";
import type {
  CandidateQualitySignals,
  ImportedCandidate,
  TechnologyPriorityRanking
} from "@/types/content";

interface ImportedCandidateCardProps {
  candidate: ImportedCandidate;
  hasSourceDetail?: boolean;
  quality?: CandidateQualitySignals;
  ranking?: TechnologyPriorityRanking;
}

export function ImportedCandidateCard({
  candidate,
  hasSourceDetail = false,
  quality,
  ranking
}: ImportedCandidateCardProps) {
  const visibleQualityFlags = quality?.flags.slice(0, 3) ?? [];
  const hiddenQualityFlagCount = Math.max((quality?.flags.length ?? 0) - 3, 0);

  return (
    <article className="candidate-card workspace-record-card">
      <div className="candidate-card__meta">
        <div className="candidate-card__meta-row">
          <span className="candidate-card__source-type">
            {getImportedCandidateSourceTypeLabel(candidate.sourceType)}
          </span>
          <span className="candidate-card__source-name">
            {candidate.sourceName}
          </span>
        </div>
        <div className="candidate-card__meta-row candidate-card__meta-row--muted">
          <span>{candidate.publisherName}</span>
          <span>{candidate.publishDate}</span>
        </div>
      </div>

      <div className="candidate-card__body">
        <h2>
          <Link href={`/workspace/candidates/${candidate.id}`}>
            {candidate.originalTitle}
          </Link>
        </h2>
        <p>{getImportedCandidatePreviewText(candidate)}</p>
      </div>

      <div className="candidate-card__badges">
        <ImportedCandidateStatusBadge status={candidate.importStatus} />
        <span className="info-pill">
          {getImportedCandidateNormalizedTypeLabel(candidate.normalizedType)}
        </span>
        {ranking ? (
          <span className={getPriorityLevelClass(ranking.priorityLevel)}>
            {getPriorityLevelLabel(ranking.priorityLevel)}
          </span>
        ) : null}
        <span className="info-pill">
          {candidate.originalLanguage.toUpperCase()}
        </span>
        {candidate.relatedCandidateIds.length > 0 &&
        candidate.duplicateGroupId ? (
          <Link
            href={`/workspace/duplicates/${candidate.duplicateGroupId}`}
            className="info-pill info-pill--warning"
          >
            {getImportedCandidateDuplicateLabel(candidate)}
          </Link>
        ) : null}
        {visibleQualityFlags.map((flag) => (
          <span key={flag} className={getCandidateQualityFlagClass(flag)}>
            {getCandidateQualityFlagLabel(flag)}
          </span>
        ))}
        {hiddenQualityFlagCount > 0 ? (
          <span className="info-pill info-pill--subtle">
            +{hiddenQualityFlagCount} quality flags
          </span>
        ) : null}
        {candidate.convertedTechnologyId ? (
          <Link
            href={`/workspace/technologies/${candidate.convertedTechnologyId}`}
            className="detail-info-card__link"
          >
            Open workspace record
          </Link>
        ) : null}
        {hasSourceDetail && candidate.sourceId ? (
          <Link
            href={`/workspace/sources/${candidate.sourceId}`}
            className="detail-info-card__link"
          >
            Open source
          </Link>
        ) : null}
      </div>
    </article>
  );
}
