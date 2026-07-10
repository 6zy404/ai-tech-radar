import { evaluateCandidateQuality } from "@/lib/quality-signals";
import type {
  CandidateQualitySignals,
  DuplicateGroupStatus,
  ImportedCandidate,
  PriorityLevel,
  SourceQualityMetrics,
  TechnologyItem,
  TechnologyPriorityRanking
} from "@/types/content";

interface RankingOptions {
  sourceQuality?: SourceQualityMetrics;
  candidateQuality?: CandidateQualitySignals;
  duplicateGroupStatus?: DuplicateGroupStatus;
  additionalReferenceCount?: number;
  existingRanking?: TechnologyPriorityRanking;
  now?: Date;
}

interface ScoreState {
  score: number;
  reasons: string[];
  warnings: string[];
}

const blockingQualityFlags = new Set([
  "missing_summary",
  "missing_content",
  "invalid_source_url",
  "invalid_publish_date"
]);

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function getAgeInDays(
  dateValue: string | undefined,
  now: Date
): number | undefined {
  if (!dateValue) {
    return undefined;
  }

  const time = Date.parse(dateValue);

  if (Number.isNaN(time)) {
    return undefined;
  }

  return Math.max(0, (now.valueOf() - time) / (1000 * 60 * 60 * 24));
}

function applySourceQuality(
  state: ScoreState,
  sourceQuality: SourceQualityMetrics | undefined
) {
  if (!sourceQuality) {
    state.score -= 4;
    state.warnings.push("暂无来源质量数据。");
    return;
  }

  if (sourceQuality.qualityLevel === "good") {
    state.score += 18;
    state.reasons.push("来源质量良好。");
  } else if (sourceQuality.qualityLevel === "watch") {
    state.score += 4;
    state.warnings.push("来源质量需要关注。");
  } else if (sourceQuality.qualityLevel === "poor") {
    state.score -= 25;
    state.warnings.push("来源质量较差。");
  } else {
    state.score -= 8;
    state.warnings.push("来源质量尚不明确。");
  }

  if (sourceQuality.successRate >= 0.8) {
    state.score += 6;
    state.reasons.push("来源导入成功率稳定。");
  }

  if (sourceQuality.duplicateRate >= 0.5) {
    state.score -= 10;
    state.warnings.push("来源重复率偏高。");
  }

  if (sourceQuality.conversionRate > 0) {
    state.score += 6;
    state.reasons.push("该来源此前产出过成功转换的候选。");
  }

  if (sourceQuality.rejectionRate >= 0.35) {
    state.score -= 10;
    state.warnings.push("来源拒绝率偏高。");
  }
}

function applyCandidateQuality(
  state: ScoreState,
  candidateQuality: CandidateQualitySignals
) {
  if (candidateQuality.isConvertible) {
    state.score += 12;
    state.reasons.push("候选已具备审核条件。");
  }

  for (const flag of candidateQuality.flags) {
    if (flag === "missing_summary") {
      state.score -= 15;
      state.warnings.push("候选缺少摘要。");
    }

    if (flag === "missing_content") {
      state.score -= 12;
      state.warnings.push("候选缺少正文。");
    }

    if (flag === "missing_publisher") {
      state.score -= 8;
      state.warnings.push("发布方不明确。");
    }

    if (flag === "invalid_source_url") {
      state.score -= 20;
      state.warnings.push("来源 URL 无效。");
    }

    if (flag === "invalid_publish_date") {
      state.score -= 10;
      state.warnings.push("发布日期无效。");
    }

    if (flag === "missing_tags") {
      state.score -= 8;
      state.warnings.push("缺少标签。");
    }

    if (flag === "too_short") {
      state.score -= 12;
      state.warnings.push("摘要或正文过短。");
    }

    if (flag === "not_convertible") {
      state.score -= 12;
      state.warnings.push("候选当前无法转换。");
    }
  }

  if (
    candidateQuality.flags.some((flag) => blockingQualityFlags.has(flag)) ||
    candidateQuality.flags.length >= 4
  ) {
    state.score -= 8;
    state.warnings.push("候选存在多项质量问题。");
  }
}

function applyDuplicateSignals(
  state: ScoreState,
  candidateQuality: CandidateQualitySignals | undefined,
  duplicateGroupStatus: DuplicateGroupStatus | undefined,
  additionalReferenceCount: number
) {
  if (additionalReferenceCount > 0) {
    state.score += Math.min(12, 6 + additionalReferenceCount * 2);
    state.reasons.push("多个来源指向同一技术事件。");
    return;
  }

  if (!candidateQuality?.isDuplicate) {
    return;
  }

  if (duplicateGroupStatus === "resolved") {
    state.score += 5;
    state.reasons.push("重复组已解决。");
  } else if (duplicateGroupStatus === "ignored") {
    state.warnings.push("重复提示已被审核者忽略。");
  } else {
    state.score -= 18;
    state.warnings.push("疑似重复仍需审核。");
  }
}

function applyContentCompleteness(
  state: ScoreState,
  item: Pick<
    TechnologyItem,
    | "title"
    | "summary"
    | "content"
    | "tags"
    | "relatedKnowledgeIds"
    | "relatedSkillIds"
    | "publisherName"
  >
) {
  if (hasText(item.title.original) || hasText(item.title.zh)) {
    state.score += 5;
    state.reasons.push("标题完整。");
  }

  if (hasText(item.summary.original) || hasText(item.summary.zh)) {
    state.score += 5;
    state.reasons.push("摘要完整。");
  } else {
    state.score -= 15;
    state.warnings.push("缺少摘要。");
  }

  if (hasText(item.content.original) || hasText(item.content.zh)) {
    state.score += 5;
    state.reasons.push("正文完整。");
  } else {
    state.score -= 12;
    state.warnings.push("缺少正文。");
  }

  if (item.tags.length > 0) {
    state.score += 6;
    state.reasons.push("已配置标签。");
  } else {
    state.score -= 8;
    state.warnings.push("缺少标签。");
  }

  if (item.relatedKnowledgeIds.length > 0) {
    state.score += 5;
    state.reasons.push("已关联背景知识。");
  } else {
    state.warnings.push("尚未关联背景知识。");
  }

  if (item.relatedSkillIds.length > 0) {
    state.score += 5;
    state.reasons.push("已关联技能。");
  } else {
    state.warnings.push("尚未关联技能。");
  }

  if (hasText(item.publisherName)) {
    state.score += 4;
    state.reasons.push("发布方明确。");
  } else {
    state.score -= 8;
    state.warnings.push("缺少发布方。");
  }
}

function applyRecency(
  state: ScoreState,
  publishDate: string | undefined,
  importedAt: string | undefined,
  now: Date
) {
  const publishAge = getAgeInDays(publishDate, now);
  const importAge = getAgeInDays(importedAt, now);
  const age = publishAge ?? importAge;

  if (age === undefined) {
    state.score -= 5;
    state.warnings.push("无法判断时效性。");
    return;
  }

  if (age <= 30) {
    state.score += 8;
    state.reasons.push("信号发布时间很近。");
  } else if (age <= 90) {
    state.score += 4;
    state.reasons.push("信号仍在较新时间窗内。");
  } else {
    state.score -= 5;
    state.warnings.push("信号已超出建议的审核时间窗。");
  }
}

function determinePriorityLevel(
  score: number,
  warnings: string[]
): PriorityLevel {
  const hasSevereWarning = warnings.some((warning) =>
    /poor|invalid|missing|duplicate still|multiple quality/i.test(warning)
  );

  if (score >= 75 && !hasSevereWarning) {
    return "high_priority";
  }

  if (score >= 45) {
    return "watch";
  }

  return "low_priority";
}

function buildRanking(
  state: ScoreState,
  options: Pick<RankingOptions, "existingRanking" | "now">
): TechnologyPriorityRanking {
  if (options.existingRanking?.rankingSource === "manual_override") {
    return options.existingRanking;
  }

  const priorityScore = clampScore(state.score);
  const priorityWarnings = Array.from(new Set(state.warnings));
  const priorityReasons = Array.from(new Set(state.reasons));

  return {
    priorityLevel: determinePriorityLevel(priorityScore, priorityWarnings),
    priorityScore,
    priorityReasons:
      priorityReasons.length > 0
        ? priorityReasons
        : ["规则排序已获得足够信息完成基础分级。"],
    priorityWarnings,
    rankingUpdatedAt: (options.now ?? new Date()).toISOString(),
    rankingSource: "rule_based"
  };
}

export function evaluateImportedCandidatePriority(
  candidate: ImportedCandidate,
  options: RankingOptions = {}
): TechnologyPriorityRanking {
  const now = options.now ?? new Date();
  const candidateQuality =
    options.candidateQuality ?? evaluateCandidateQuality(candidate);
  const state: ScoreState = {
    score: 50,
    reasons: [],
    warnings: []
  };

  applySourceQuality(state, options.sourceQuality);
  applyCandidateQuality(state, candidateQuality);
  applyDuplicateSignals(
    state,
    candidateQuality,
    options.duplicateGroupStatus,
    options.additionalReferenceCount ?? 0
  );
  applyRecency(state, candidate.publishDate, candidate.importedAt, now);

  if (hasText(candidate.originalTitle)) {
    state.score += 5;
    state.reasons.push("标题存在。");
  }

  if (candidate.tags.length > 0) {
    state.score += 6;
    state.reasons.push("已配置标签。");
  }

  if (hasText(candidate.publisherName)) {
    state.score += 4;
    state.reasons.push("发布方明确。");
  }

  return buildRanking(state, {
    existingRanking: options.existingRanking,
    now
  });
}

export function evaluateTechnologyPriority(
  technology: TechnologyItem,
  options: RankingOptions = {}
): TechnologyPriorityRanking {
  const now = options.now ?? new Date();
  const state: ScoreState = {
    score: 50,
    reasons: [],
    warnings: []
  };

  applyContentCompleteness(state, technology);
  applyDuplicateSignals(
    state,
    undefined,
    options.duplicateGroupStatus,
    options.additionalReferenceCount ?? technology.sourceReferences?.length ?? 0
  );
  applyRecency(state, technology.publishDate, undefined, now);

  if (technology.importanceLevel === "critical") {
    state.score += 10;
    state.reasons.push("编辑标记为关键重要性。");
  } else if (technology.importanceLevel === "important") {
    state.score += 6;
    state.reasons.push("编辑标记为重要。");
  }

  if (
    technology.publisherType === "big-tech" ||
    technology.publisherType === "research-lab"
  ) {
    state.score += 4;
    state.reasons.push("发布方类型属于强技术信号来源。");
  }

  return buildRanking(state, {
    existingRanking: technology.priority ?? options.existingRanking,
    now
  });
}
