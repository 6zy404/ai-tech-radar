import type {
  ExternalSource,
  ExternalSourceImportStatus,
  ExternalSourceType
} from "@/types/content";

export function getExternalSourceTypeLabel(type: ExternalSourceType): string {
  const labels: Record<ExternalSourceType, string> = {
    rss: "RSS",
    atom: "Atom",
    github_release: "GitHub 版本发布",
    official_blog: "官方博客"
  };

  return labels[type];
}

export function getExternalSourceImportStatusLabel(
  status: ExternalSourceImportStatus
): string {
  const labels: Record<ExternalSourceImportStatus, string> = {
    never_run: "未运行",
    success: "成功",
    failed: "失败",
    partial: "部分成功"
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
