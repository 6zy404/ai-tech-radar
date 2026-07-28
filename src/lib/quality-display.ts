import type { CandidateQualityFlag, SourceQualityLevel } from "@/types/content";

export function formatQualityRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getSourceQualityLevelLabel(level: SourceQualityLevel): string {
  const labels: Record<SourceQualityLevel, string> = {
    good: "良好",
    watch: "关注",
    poor: "较差",
    unknown: "未知"
  };

  return labels[level];
}

export function getSourceQualityLevelClass(level: SourceQualityLevel): string {
  const classes: Record<SourceQualityLevel, string> = {
    good: "info-pill info-pill--success",
    watch: "info-pill info-pill--warning",
    poor: "info-pill info-pill--danger",
    unknown: "info-pill info-pill--subtle"
  };

  return classes[level];
}

export function getCandidateQualityFlagLabel(
  flag: CandidateQualityFlag
): string {
  const labels: Record<CandidateQualityFlag, string> = {
    missing_summary: "缺摘要",
    missing_content: "缺正文",
    missing_publisher: "缺发布方",
    invalid_source_url: "URL 无效",
    invalid_publish_date: "日期无效",
    missing_tags: "缺标签",
    possible_duplicate: "疑似重复",
    too_short: "内容过短",
    prerelease_version: "预发布版本",
    already_published: "已发布过",
    ready_for_review: "可审核",
    not_convertible: "转换受阻"
  };

  return labels[flag];
}

export function getCandidateQualityFlagClass(
  flag: CandidateQualityFlag
): string {
  if (flag === "ready_for_review") {
    return "info-pill info-pill--success";
  }

  if (
    flag === "not_convertible" ||
    flag === "possible_duplicate" ||
    flag === "already_published"
  ) {
    return "info-pill info-pill--warning";
  }

  return "info-pill info-pill--subtle";
}
