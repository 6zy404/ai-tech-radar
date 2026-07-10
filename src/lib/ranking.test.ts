import { describe, expect, it } from "vitest";

import { evaluateTechnologyPriority } from "@/lib/ranking";
import { makeTechnologyItem } from "@/lib/test-factories";
import type { TechnologyPriorityRanking } from "@/types/content";

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
});
