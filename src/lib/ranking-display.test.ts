import { describe, expect, it } from "vitest";

import { getPriorityUserSummary } from "@/lib/ranking-display";
import type { PriorityLevel, TechnologyPriorityRanking } from "@/types/content";

function ranking(priorityLevel: PriorityLevel): TechnologyPriorityRanking {
  return {
    priorityLevel,
    priorityScore: 90,
    priorityReasons: [],
    priorityWarnings: [],
    rankingUpdatedAt: "2026-10-12T00:00:00.000Z",
    rankingSource: "rule_based"
  };
}

describe("getPriorityUserSummary", () => {
  it("names the rule that put a signal in its band", () => {
    expect(
      getPriorityUserSummary(ranking("high_priority"), "zh", "critical")
    ).toBe("编辑标为关键，一直在立即关注。");
    expect(
      getPriorityUserSummary(ranking("high_priority"), "zh", "important")
    ).toBe("编辑标为重要，发布不满 30 天。");
    expect(getPriorityUserSummary(ranking("watch"), "zh", "important")).toBe(
      "编辑标为重要，发布已满 30 天，从立即关注降到这一档。"
    );
    expect(getPriorityUserSummary(ranking("watch"), "zh", "signal")).toBe(
      "编辑标为信号级，适合持续跟踪。"
    );
  });

  it("explains a critical signal held at watch by its record's problems", () => {
    expect(
      getPriorityUserSummary(ranking("watch"), "zh", "critical")
    ).toContain("最多到这一档");
  });

  it("puts the record's defects first in the background band, whatever the level", () => {
    for (const level of ["critical", "important", "signal"] as const) {
      expect(
        getPriorityUserSummary(ranking("low_priority"), "zh", level)
      ).toContain("缺摘要");
    }
  });

  it("states both ways into a band when the importance level is not given", () => {
    expect(getPriorityUserSummary(ranking("high_priority"), "zh")).toBe(
      "编辑标为关键，或标为重要且发布不满 30 天。"
    );
    expect(getPriorityUserSummary(ranking("watch"), "zh")).toBe(
      "编辑标为信号级，或标为重要且发布已满 30 天。"
    );
  });

  it("no longer describes the retired score-only banding", () => {
    for (const level of ["high_priority", "watch", "low_priority"] as const) {
      for (const mode of ["zh", "original"] as const) {
        const text = getPriorityUserSummary(ranking(level), mode);
        expect(text).not.toMatch(/多个信号同时成立|Multiple signals line up/);
      }
    }
  });
});
