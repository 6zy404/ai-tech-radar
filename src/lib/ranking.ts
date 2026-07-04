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
    state.warnings.push("No source quality data is available yet.");
    return;
  }

  if (sourceQuality.qualityLevel === "good") {
    state.score += 18;
    state.reasons.push("Source quality is good.");
  } else if (sourceQuality.qualityLevel === "watch") {
    state.score += 4;
    state.warnings.push("Source quality needs watching.");
  } else if (sourceQuality.qualityLevel === "poor") {
    state.score -= 25;
    state.warnings.push("Source quality is poor.");
  } else {
    state.score -= 8;
    state.warnings.push("Source quality is still unknown.");
  }

  if (sourceQuality.successRate >= 0.8) {
    state.score += 6;
    state.reasons.push("Source import success rate is stable.");
  }

  if (sourceQuality.duplicateRate >= 0.5) {
    state.score -= 10;
    state.warnings.push("Source has a high duplicate rate.");
  }

  if (sourceQuality.conversionRate > 0) {
    state.score += 6;
    state.reasons.push(
      "This source has previously produced converted candidates."
    );
  }

  if (sourceQuality.rejectionRate >= 0.35) {
    state.score -= 10;
    state.warnings.push("Source has an elevated rejection rate.");
  }
}

function applyCandidateQuality(
  state: ScoreState,
  candidateQuality: CandidateQualitySignals
) {
  if (candidateQuality.isConvertible) {
    state.score += 12;
    state.reasons.push("Candidate appears ready for review.");
  }

  for (const flag of candidateQuality.flags) {
    if (flag === "missing_summary") {
      state.score -= 15;
      state.warnings.push("Candidate summary is missing.");
    }

    if (flag === "missing_content") {
      state.score -= 12;
      state.warnings.push("Candidate content is missing.");
    }

    if (flag === "missing_publisher") {
      state.score -= 8;
      state.warnings.push("Publisher is unclear.");
    }

    if (flag === "invalid_source_url") {
      state.score -= 20;
      state.warnings.push("Source URL is invalid.");
    }

    if (flag === "invalid_publish_date") {
      state.score -= 10;
      state.warnings.push("Publish date is invalid.");
    }

    if (flag === "missing_tags") {
      state.score -= 8;
      state.warnings.push("Tags are missing.");
    }

    if (flag === "too_short") {
      state.score -= 12;
      state.warnings.push("Summary or content is too short.");
    }

    if (flag === "not_convertible") {
      state.score -= 12;
      state.warnings.push("Candidate is currently blocked from conversion.");
    }
  }

  if (
    candidateQuality.flags.some((flag) => blockingQualityFlags.has(flag)) ||
    candidateQuality.flags.length >= 4
  ) {
    state.score -= 8;
    state.warnings.push("Candidate has multiple quality issues.");
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
    state.reasons.push("Multiple sources reference the same technology event.");
    return;
  }

  if (!candidateQuality?.isDuplicate) {
    return;
  }

  if (duplicateGroupStatus === "resolved") {
    state.score += 5;
    state.reasons.push("Duplicate group has been resolved.");
  } else if (duplicateGroupStatus === "ignored") {
    state.warnings.push("Duplicate hint was ignored by reviewer.");
  } else {
    state.score -= 18;
    state.warnings.push("Possible duplicate still needs review.");
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
    state.reasons.push("Title is complete.");
  }

  if (hasText(item.summary.original) || hasText(item.summary.zh)) {
    state.score += 5;
    state.reasons.push("Summary is complete.");
  } else {
    state.score -= 15;
    state.warnings.push("Summary is missing.");
  }

  if (hasText(item.content.original) || hasText(item.content.zh)) {
    state.score += 5;
    state.reasons.push("Content is complete.");
  } else {
    state.score -= 12;
    state.warnings.push("Content is missing.");
  }

  if (item.tags.length > 0) {
    state.score += 6;
    state.reasons.push("Tags are available.");
  } else {
    state.score -= 8;
    state.warnings.push("Tags are missing.");
  }

  if (item.relatedKnowledgeIds.length > 0) {
    state.score += 5;
    state.reasons.push("Related knowledge is linked.");
  } else {
    state.warnings.push("Related knowledge is not linked yet.");
  }

  if (item.relatedSkillIds.length > 0) {
    state.score += 5;
    state.reasons.push("Related skills are linked.");
  } else {
    state.warnings.push("Related skills are not linked yet.");
  }

  if (hasText(item.publisherName)) {
    state.score += 4;
    state.reasons.push("Publisher is identified.");
  } else {
    state.score -= 8;
    state.warnings.push("Publisher is missing.");
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
    state.warnings.push("Recency cannot be determined.");
    return;
  }

  if (age <= 30) {
    state.score += 8;
    state.reasons.push("Signal is recent.");
  } else if (age <= 90) {
    state.score += 4;
    state.reasons.push("Signal is still reasonably recent.");
  } else {
    state.score -= 5;
    state.warnings.push("Signal is older than the preferred review window.");
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
        : ["Rule-based ranking found enough information for basic triage."],
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
    state.reasons.push("Title is present.");
  }

  if (candidate.tags.length > 0) {
    state.score += 6;
    state.reasons.push("Tags are available.");
  }

  if (hasText(candidate.publisherName)) {
    state.score += 4;
    state.reasons.push("Publisher is identified.");
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
    state.reasons.push("Editorial importance is critical.");
  } else if (technology.importanceLevel === "important") {
    state.score += 6;
    state.reasons.push("Editorial importance is marked important.");
  }

  if (
    technology.publisherType === "big-tech" ||
    technology.publisherType === "research-lab"
  ) {
    state.score += 4;
    state.reasons.push("Publisher type is a strong technology signal source.");
  }

  return buildRanking(state, {
    existingRanking: technology.priority ?? options.existingRanking,
    now
  });
}
