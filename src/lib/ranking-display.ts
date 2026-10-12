import type {
  ImportanceLevel,
  PriorityLevel,
  RankingSource,
  TechnologyPriorityRanking
} from "@/types/content";
import { importantFreshnessWindowDays } from "@/lib/ranking";
import type { TechnologyContentMode } from "@/lib/technology-localization";

export function getPriorityLevelLabel(
  level: PriorityLevel,
  mode: TechnologyContentMode = "original"
): string {
  if (mode === "zh") {
    const labels: Record<PriorityLevel, string> = {
      high_priority: "立即关注",
      watch: "值得跟踪",
      low_priority: "背景参考"
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
  return source === "manual_override" ? "人工覆盖" : "规则判定";
}

/**
 * The one-line reason under a published signal's band, in the terms /about
 * uses to explain the bands: the editor's importance level decides, and
 * time can only move a signal down (see `determinePriorityLevel` in
 * ranking.ts). Until 2026-10-12 these sentences still described the old
 * score-only banding ("多个信号同时成立…").
 *
 * With `importanceLevel` the sentence names the rule that applied; without
 * it, it states both ways into the band.
 */
export function getPriorityUserSummary(
  ranking: TechnologyPriorityRanking,
  mode: TechnologyContentMode,
  importanceLevel?: ImportanceLevel
): string {
  const days = importantFreshnessWindowDays;
  const level = ranking.priorityLevel;

  if (mode === "zh") {
    if (level === "low_priority") {
      return "记录缺摘要、缺正文，或来源链接、日期无效，先作为背景参考。";
    }

    if (level === "high_priority") {
      if (importanceLevel === "critical") {
        return "编辑标为关键，一直在立即关注。";
      }

      if (importanceLevel === "important") {
        return `编辑标为重要，发布不满 ${days} 天。`;
      }

      return `编辑标为关键，或标为重要且发布不满 ${days} 天。`;
    }

    if (importanceLevel === "signal") {
      return "编辑标为信号级，适合持续跟踪。";
    }

    if (importanceLevel === "important") {
      return `编辑标为重要，发布已满 ${days} 天，从立即关注降到这一档。`;
    }

    if (importanceLevel === "critical") {
      return "编辑标为关键，但记录还有待补的问题，最多到这一档。";
    }

    return `编辑标为信号级，或标为重要且发布已满 ${days} 天。`;
  }

  if (level === "low_priority") {
    return "The record is missing its summary or body, or its source link or date is invalid, so treat it as background.";
  }

  if (level === "high_priority") {
    if (importanceLevel === "critical") {
      return "Marked critical by the editors; it stays in this band.";
    }

    if (importanceLevel === "important") {
      return `Marked important by the editors and published within ${days} days.`;
    }

    return `Marked critical, or marked important and published within ${days} days.`;
  }

  if (importanceLevel === "signal") {
    return "Marked as a signal by the editors; worth tracking.";
  }

  if (importanceLevel === "important") {
    return `Marked important, but published more than ${days} days ago, so it moved down to this band.`;
  }

  if (importanceLevel === "critical") {
    return "Marked critical, but the record still has open problems, so it stops at this band.";
  }

  return `Marked as a signal, or marked important and published more than ${days} days ago.`;
}
