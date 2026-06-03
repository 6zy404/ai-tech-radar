import type {
  PriorityLevel,
  RankingSource,
  TechnologyPriorityRanking
} from "@/types/content";
import type { TechnologyContentMode } from "@/lib/technology-localization";

export function getPriorityLevelLabel(
  level: PriorityLevel,
  mode: TechnologyContentMode = "original"
): string {
  if (mode === "zh") {
    const labels: Record<PriorityLevel, string> = {
      high_priority: "立即关注",
      watch: "值得跟踪",
      low_priority: "可以了解"
    };

    return labels[level];
  }

  const labels: Record<PriorityLevel, string> = {
    high_priority: "Immediate attention",
    watch: "Worth tracking",
    low_priority: "Good to know"
  };

  return labels[level];
}

export function getPriorityLevelClass(level: PriorityLevel): string {
  const classes: Record<PriorityLevel, string> = {
    high_priority: "info-pill info-pill--danger",
    watch: "info-pill info-pill--warning",
    low_priority: "info-pill info-pill--subtle"
  };

  return classes[level];
}

export function getRankingSourceLabel(source: RankingSource): string {
  return source === "manual_override" ? "Manual override" : "Rule-based";
}

export function getPriorityUserSummary(
  ranking: TechnologyPriorityRanking,
  mode: TechnologyContentMode
): string {
  if (mode === "zh") {
    const labels: Record<PriorityLevel, string> = {
      high_priority: "多个信号同时成立，建议优先评估这条技术变化。",
      watch: "基础信息较完整，适合持续跟踪并等待更多验证。",
      low_priority: "信号价值或信息完整度有限，先作为背景了解即可。"
    };

    return labels[ranking.priorityLevel];
  }

  const labels: Record<PriorityLevel, string> = {
    high_priority:
      "Multiple signals line up, so this technology is worth evaluating early.",
    watch:
      "The signal is useful, but it still needs more context or validation.",
    low_priority:
      "The signal is incomplete or lower confidence, so treat it as background."
  };

  return labels[ranking.priorityLevel];
}
