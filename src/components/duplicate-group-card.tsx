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

const groupStatusLabels: Record<DuplicateGroup["status"], string> = {
  open: "待处理",
  resolved: "已解决",
  ignored: "已忽略"
};

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
            label={groupStatusLabels[group.status]}
            tone={getStatusTone(group.status)}
          />
          <span className="candidate-card__source-type">
            {candidates.length} 条候选
          </span>
          <span className="candidate-card__source-name">{group.id}</span>
        </div>
        <div className="candidate-card__meta-row candidate-card__meta-row--muted">
          <span>主候选：{primaryCandidate?.id ?? "未选择"}</span>
          <span>更新于 {group.updatedAt.slice(0, 10)}</span>
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
            "在把候选转换为技术草稿前，请先审核这个重复组。"}
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
          审核重复组
        </Link>
      </div>
    </article>
  );
}
