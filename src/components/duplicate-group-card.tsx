import Link from "next/link";

import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import {
  getDuplicateReasonLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import type { DuplicateGroup, ImportedCandidate } from "@/types/content";

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  candidates: ImportedCandidate[];
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

export function DuplicateGroupCard({
  group,
  candidates
}: DuplicateGroupCardProps) {
  const primaryCandidate =
    candidates.find((candidate) => candidate.id === group.primaryCandidateId) ??
    candidates[0];

  return (
    <article className="candidate-card workspace-record-card duplicate-group-card">
      <div className="candidate-card__meta">
        <div className="candidate-card__meta-row">
          <WorkspaceStatusBadge
            label={group.status}
            tone={getStatusTone(group.status)}
          />
          <span className="candidate-card__source-type">
            {candidates.length} candidates
          </span>
          <span className="candidate-card__source-name">{group.id}</span>
        </div>
        <div className="candidate-card__meta-row candidate-card__meta-row--muted">
          <span>Primary: {primaryCandidate?.id ?? "Not selected"}</span>
          <span>Updated {group.updatedAt.slice(0, 10)}</span>
        </div>
      </div>

      <div className="candidate-card__body">
        <h2>
          <Link href={`/workspace/duplicates/${group.id}`}>
            {primaryCandidate?.originalTitle ?? group.id}
          </Link>
        </h2>
        <p>
          {primaryCandidate?.originalSummary ??
            "Review this duplicate group before converting candidates into a technology draft."}
        </p>
      </div>

      <div className="candidate-card__badges">
        {group.reasons.map((reason) => (
          <span key={reason} className="info-pill info-pill--warning">
            {getDuplicateReasonLabel(reason)}
          </span>
        ))}
        {candidates.slice(0, 3).map((candidate) => (
          <span key={candidate.id} className="info-pill">
            {getImportedCandidateSourceTypeLabel(candidate.sourceType)}
          </span>
        ))}
        {primaryCandidate ? (
          <ImportedCandidateStatusBadge
            status={primaryCandidate.importStatus}
          />
        ) : null}
        <Link
          href={`/workspace/duplicates/${group.id}`}
          className="action-link"
        >
          Review group
        </Link>
      </div>
    </article>
  );
}
