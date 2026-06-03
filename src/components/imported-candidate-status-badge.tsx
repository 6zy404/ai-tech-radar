import { getImportedCandidateStatusLabel } from "@/lib/imported-candidate-display";
import type { CandidateImportStatus } from "@/types/content";

interface ImportedCandidateStatusBadgeProps {
  status: CandidateImportStatus;
}

export function ImportedCandidateStatusBadge({
  status
}: ImportedCandidateStatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {getImportedCandidateStatusLabel(status)}
    </span>
  );
}
