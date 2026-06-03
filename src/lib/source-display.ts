import type {
  ExternalSource,
  ExternalSourceImportStatus,
  ExternalSourceType
} from "@/types/content";

export function getExternalSourceTypeLabel(type: ExternalSourceType): string {
  const labels: Record<ExternalSourceType, string> = {
    rss: "RSS",
    atom: "Atom",
    github_release: "GitHub Release",
    official_blog: "Official Blog"
  };

  return labels[type];
}

export function getExternalSourceImportStatusLabel(
  status: ExternalSourceImportStatus
): string {
  const labels: Record<ExternalSourceImportStatus, string> = {
    never_run: "Never run",
    success: "Success",
    failed: "Failed",
    partial: "Partial"
  };

  return labels[status];
}

export function getExternalSourceSearchText(source: ExternalSource): string {
  return [
    source.name,
    source.url,
    source.publisherName,
    source.type,
    source.defaultTags.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
