import type {
  CandidateImportStatus,
  CandidateNormalizedType,
  DuplicateReason,
  ImportedCandidate,
  ImportedSourceType
} from "@/types/content";

export function getImportedCandidateSourceTypeLabel(
  sourceType: ImportedSourceType
): string {
  const labels: Record<ImportedSourceType, string> = {
    "rss-feed": "RSS / Atom",
    "github-release": "GitHub 版本发布",
    "official-blog": "官方博客"
  };

  return labels[sourceType];
}

export function getImportedCandidateStatusLabel(
  status: CandidateImportStatus
): string {
  const labels: Record<CandidateImportStatus, string> = {
    new: "新候选",
    reviewed: "已审核",
    converted: "已转换",
    rejected: "已拒绝"
  };

  return labels[status];
}

export function getImportedCandidateNormalizedTypeLabel(
  normalizedType: CandidateNormalizedType
): string {
  const labels: Partial<Record<CandidateNormalizedType, string>> = {
    unknown: "未知",
    platform: "平台",
    tool: "工具",
    model: "模型",
    protocol: "协议",
    workflow: "工作流"
  };

  return (
    labels[normalizedType] ??
    normalizedType
      .split("-")
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(" ")
  );
}

export function getImportedCandidatePreviewText(
  candidate: ImportedCandidate
): string {
  return candidate.originalSummary ?? candidate.originalContent ?? "暂无摘要。";
}

export function getImportedCandidateSearchText(
  candidate: ImportedCandidate
): string {
  return [
    candidate.originalTitle,
    candidate.originalSummary,
    candidate.originalContent,
    candidate.sourceName,
    candidate.publisherName,
    candidate.normalizedType,
    candidate.sourceType,
    candidate.importStatus,
    ...candidate.tags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getImportedCandidateDuplicateLabel(
  candidate: ImportedCandidate
): string {
  const duplicateCount = candidate.relatedCandidateIds.length;

  if (duplicateCount === 0) {
    return "无重复提示";
  }

  return `${duplicateCount} 条疑似重复`;
}

export function getDuplicateReasonLabel(reason: DuplicateReason): string {
  const labels: Record<DuplicateReason, string> = {
    same_source_url: "来源 URL 相同",
    similar_title: "标题高度相似",
    same_publisher_near_date: "同发布方且日期相近",
    same_repo_release_family: "同一 GitHub 仓库版本系列",
    same_canonical_url: "规范链接相同"
  };

  return labels[reason];
}
