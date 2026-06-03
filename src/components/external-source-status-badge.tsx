import {
  getExternalSourceImportStatusLabel
} from "@/lib/source-display";
import type { ExternalSourceImportStatus } from "@/types/content";

interface ExternalSourceStatusBadgeProps {
  status: ExternalSourceImportStatus;
}

export function ExternalSourceStatusBadge({
  status
}: ExternalSourceStatusBadgeProps) {
  const tone =
    status === "success"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "partial"
          ? "warning"
          : "neutral";

  return (
    <span className={`status-badge status-badge--${tone}`}>
      {getExternalSourceImportStatusLabel(status)}
    </span>
  );
}
