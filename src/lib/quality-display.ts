import type { CandidateQualityFlag, SourceQualityLevel } from "@/types/content";

export function formatQualityRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getSourceQualityLevelLabel(level: SourceQualityLevel): string {
  const labels: Record<SourceQualityLevel, string> = {
    good: "Good",
    watch: "Watch",
    poor: "Poor",
    unknown: "Unknown"
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
    missing_summary: "No summary",
    missing_content: "No content",
    missing_publisher: "No publisher",
    invalid_source_url: "Invalid URL",
    invalid_publish_date: "Invalid date",
    missing_tags: "No tags",
    possible_duplicate: "Possible duplicate",
    too_short: "Too short",
    ready_for_review: "Ready for review",
    not_convertible: "Convert blocked"
  };

  return labels[flag];
}

export function getCandidateQualityFlagClass(
  flag: CandidateQualityFlag
): string {
  if (flag === "ready_for_review") {
    return "info-pill info-pill--success";
  }

  if (flag === "not_convertible" || flag === "possible_duplicate") {
    return "info-pill info-pill--warning";
  }

  return "info-pill info-pill--subtle";
}
