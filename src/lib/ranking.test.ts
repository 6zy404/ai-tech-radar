import { describe, expect, it } from "vitest";

import {
  evaluateImportedCandidatePriority,
  evaluateTechnologyPriority
} from "@/lib/ranking";
import {
  makeImportedCandidate,
  makeTechnologyItem
} from "@/lib/test-factories";
import type {
  CandidateQualitySignals,
  SourceQualityMetrics,
  TechnologyPriorityRanking
} from "@/types/content";

// Fixed "now" so recency scoring (and therefore priority level) is deterministic.
const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("evaluateTechnologyPriority", () => {
  it("marks a complete, recent, critical big-tech technology as high priority", () => {
    const technology = makeTechnologyItem({ publishDate: "2026-05-20" });

    const ranking = evaluateTechnologyPriority(technology, { now: NOW });

    expect(ranking.priorityLevel).toBe("high_priority");
    expect(ranking.rankingSource).toBe("rule_based");
    expect(ranking.priorityScore).toBeGreaterThanOrEqual(75);
    expect(ranking.priorityReasons.length).toBeGreaterThan(0);
  });

  it("marks a sparse, stale technology as low priority with warnings", () => {
    const technology = makeTechnologyItem({
      summary: { original: "" },
      content: { original: "" },
      tags: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: [],
      publisherName: "",
      importanceLevel: "signal",
      publisherType: "media",
      publishDate: "2024-01-01"
    });

    const ranking = evaluateTechnologyPriority(technology, { now: NOW });

    expect(ranking.priorityLevel).toBe("low_priority");
    expect(ranking.priorityScore).toBeLessThan(45);
    expect(ranking.priorityWarnings).toContain("缺少摘要。");
  });

  it("keeps a critical technology in high priority even when it is stale", () => {
    const technology = makeTechnologyItem({
      importanceLevel: "critical",
      publishDate: "2026-01-05"
    });

    const ranking = evaluateTechnologyPriority(technology, { now: NOW });

    expect(ranking.priorityLevel).toBe("high_priority");
  });

  it("demotes an important technology to watch once it leaves the freshness window", () => {
    const fresh = evaluateTechnologyPriority(
      makeTechnologyItem({
        importanceLevel: "important",
        publishDate: "2026-05-20"
      }),
      { now: NOW }
    );
    const stale = evaluateTechnologyPriority(
      makeTechnologyItem({
        importanceLevel: "important",
        publishDate: "2026-03-20"
      }),
      { now: NOW }
    );

    expect(fresh.priorityLevel).toBe("high_priority");
    expect(stale.priorityLevel).toBe("watch");
    // The demotion is editorial banding, not a scoring collapse.
    expect(stale.priorityScore).toBeGreaterThanOrEqual(45);
  });

  it("keeps a complete signal-level technology in watch no matter how fresh or high-scoring", () => {
    const technology = makeTechnologyItem({
      importanceLevel: "signal",
      publishDate: "2026-05-31"
    });

    const ranking = evaluateTechnologyPriority(technology, { now: NOW });

    expect(ranking.priorityScore).toBeGreaterThanOrEqual(75);
    expect(ranking.priorityLevel).toBe("watch");
  });

  it("returns a manual override unchanged instead of recomputing", () => {
    const manualRanking: TechnologyPriorityRanking = {
      priorityLevel: "watch",
      priorityScore: 50,
      priorityReasons: ["Editor pinned this as watch."],
      priorityWarnings: [],
      rankingUpdatedAt: "2026-01-01T00:00:00.000Z",
      rankingSource: "manual_override"
    };

    const ranking = evaluateTechnologyPriority(makeTechnologyItem(), {
      now: NOW,
      existingRanking: manualRanking
    });

    expect(ranking).toEqual(manualRanking);
  });

  it("is deterministic for the same input and clock", () => {
    const technology = makeTechnologyItem();

    const first = evaluateTechnologyPriority(technology, { now: NOW });
    const second = evaluateTechnologyPriority(technology, { now: NOW });

    expect(first).toEqual(second);
  });

  it("caps a critical technology at watch while it carries a severe warning", () => {
    const ranking = evaluateTechnologyPriority(
      makeTechnologyItem({ importanceLevel: "critical", tags: [] }),
      { now: NOW }
    );

    expect(ranking.priorityWarnings).toContain("缺少标签。");
    expect(ranking.priorityScore).toBeGreaterThanOrEqual(75);
    expect(ranking.priorityLevel).toBe("watch");
  });
});

describe("evaluateImportedCandidatePriority: severe warnings", () => {
  const goodSource: SourceQualityMetrics = {
    successRate: 1,
    totalImportRuns: 10,
    successfulImportRuns: 10,
    failedImportRuns: 0,
    totalCandidatesImported: 20,
    convertedCandidateCount: 5,
    rejectedCandidateCount: 2,
    duplicateCandidateCount: 0,
    duplicateRate: 0,
    conversionRate: 0.25,
    rejectionRate: 0.1,
    consecutiveFailureCount: 0,
    qualityLevel: "good"
  };
  const quality = (isDuplicate: boolean): CandidateQualitySignals => ({
    hasTitle: true,
    hasSummary: true,
    hasContent: true,
    hasSourceUrl: true,
    hasPublisher: true,
    hasValidPublishDate: true,
    hasTags: true,
    isDuplicate,
    isTooShort: false,
    isPrerelease: false,
    isAlreadyPublished: false,
    isSimilarToPublished: false,
    isDefacementTitle: false,
    isConvertible: true,
    flags: isDuplicate
      ? ["possible_duplicate", "ready_for_review"]
      : ["ready_for_review"]
  });

  it("keeps a high-scoring unreviewed duplicate out of 立即关注", () => {
    const candidate = makeImportedCandidate();
    const clean = evaluateImportedCandidatePriority(candidate, {
      now: NOW,
      sourceQuality: goodSource,
      candidateQuality: quality(false)
    });
    const duplicate = evaluateImportedCandidatePriority(candidate, {
      now: NOW,
      sourceQuality: goodSource,
      candidateQuality: quality(true)
    });

    expect(clean.priorityLevel).toBe("high_priority");
    expect(duplicate.priorityWarnings).toContain("疑似重复仍需审核。");
    expect(duplicate.priorityScore).toBeGreaterThanOrEqual(75);
    expect(duplicate.priorityLevel).toBe("watch");
  });

  it("does not treat 尚未关联背景知识 as severe", () => {
    const ranking = evaluateTechnologyPriority(
      makeTechnologyItem({
        importanceLevel: "critical",
        relatedKnowledgeIds: [],
        relatedSkillIds: []
      }),
      { now: NOW }
    );

    expect(ranking.priorityWarnings).toContain("尚未关联背景知识。");
    expect(ranking.priorityLevel).toBe("high_priority");
  });
});
