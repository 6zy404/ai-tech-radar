import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTechnologyItem } from "@/lib/test-factories";
import {
  getWeeklyReview,
  getWeeklyReviewArchive,
  getWeeklyReviewNeighbors
} from "@/lib/weekly-review";
import type {
  PriorityLevel,
  TechnologyItem,
  TechnologyPriorityRanking
} from "@/types/content";

const { getAllTechnologiesMock } = vi.hoisted(() => ({
  getAllTechnologiesMock: vi.fn<() => TechnologyItem[]>()
}));

const { getTodayDateStringMock } = vi.hoisted(() => ({
  getTodayDateStringMock: vi.fn<() => string>()
}));

const { evaluateTechnologyPriorityMock } = vi.hoisted(() => ({
  evaluateTechnologyPriorityMock:
    vi.fn<(technology: TechnologyItem) => TechnologyPriorityRanking>()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: getAllTechnologiesMock
}));

vi.mock("@/lib/digest-store", () => ({
  getTodayDateString: getTodayDateStringMock
}));

vi.mock("@/lib/ranking", () => ({
  evaluateTechnologyPriority: evaluateTechnologyPriorityMock
}));

// Deterministic level per importance, so the tests exercise weekly-review's own
// bucketing/exclusion/sorting rather than Ranking v0's scoring.
const levelByImportance: Record<
  TechnologyItem["importanceLevel"],
  PriorityLevel
> = {
  critical: "high_priority",
  important: "watch",
  signal: "low_priority"
};

function ranking(level: PriorityLevel): TechnologyPriorityRanking {
  return {
    priorityLevel: level,
    priorityScore: 50,
    priorityReasons: [],
    priorityWarnings: [],
    rankingUpdatedAt: "2026-07-22T00:00:00.000Z",
    rankingSource: "rule_based"
  };
}

function tech(overrides: Partial<TechnologyItem>): TechnologyItem {
  return makeTechnologyItem({
    sourceLanguage: "zh",
    translationStatus: "not_needed",
    ...overrides
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Wednesday: natural week is Mon 2026-07-20 .. Sun 2026-07-26.
  getTodayDateStringMock.mockReturnValue("2026-07-22");
  evaluateTechnologyPriorityMock.mockImplementation((technology) =>
    ranking(levelByImportance[technology.importanceLevel])
  );
});

describe("getWeeklyReview (current week)", () => {
  it("buckets published signals into the natural week and excludes low_priority", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech({
        id: "a",
        slug: "a",
        publishDate: "2026-07-21",
        importanceLevel: "critical",
        tags: ["tag-x", "tag-y"]
      }),
      tech({
        id: "b",
        slug: "b",
        publishDate: "2026-07-20",
        importanceLevel: "important",
        tags: ["tag-y"]
      }),
      tech({
        id: "c",
        slug: "c",
        publishDate: "2026-07-26",
        importanceLevel: "signal",
        tags: ["tag-z"]
      }),
      tech({
        id: "d",
        slug: "d",
        publishDate: "2026-07-19",
        importanceLevel: "critical"
      })
    ]);

    const data = getWeeklyReview();

    expect(data).toBeDefined();
    expect(data?.weekKey).toBe("2026-07-20");
    expect(data?.weekStart).toBe("2026-07-20");
    expect(data?.weekEnd).toBe("2026-07-26");
    expect(data?.isCurrentWeek).toBe(true);
    expect(data?.highPriorityCount).toBe(1);
    expect(data?.watchCount).toBe(1);
    // low_priority "c" excluded; "d" is in the previous week.
    expect(data?.totalCount).toBe(2);
    // Topics counted only across shown (high + watch) signals: x, y.
    expect(data?.topicCount).toBe(2);
    expect(data?.groups.map((group) => group.level)).toEqual([
      "high_priority",
      "watch"
    ]);
  });

  it("orders signals within a group newest-first", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech({
        id: "older",
        slug: "older",
        publishDate: "2026-07-20",
        importanceLevel: "critical"
      }),
      tech({
        id: "newer",
        slug: "newer",
        publishDate: "2026-07-22",
        importanceLevel: "critical"
      })
    ]);

    const data = getWeeklyReview();
    const highGroup = data?.groups.find(
      (group) => group.level === "high_priority"
    );

    expect(highGroup?.signals.map((signal) => signal.slug)).toEqual([
      "newer",
      "older"
    ]);
  });
});

describe("getWeeklyReview (specific week)", () => {
  it("resolves a canonical Monday key", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech({
        id: "d",
        slug: "d",
        publishDate: "2026-07-19",
        importanceLevel: "critical"
      })
    ]);

    const data = getWeeklyReview("2026-07-13");

    expect(data?.weekKey).toBe("2026-07-13");
    expect(data?.weekEnd).toBe("2026-07-19");
    expect(data?.isCurrentWeek).toBe(false);
    expect(data?.totalCount).toBe(1);
  });

  it("returns undefined for a non-Monday (non-canonical) key", () => {
    getAllTechnologiesMock.mockReturnValue([]);

    expect(getWeeklyReview("2026-07-14")).toBeUndefined();
  });

  it("returns undefined for an invalid date string", () => {
    getAllTechnologiesMock.mockReturnValue([]);

    expect(getWeeklyReview("not-a-date")).toBeUndefined();
  });
});

describe("getWeeklyReviewArchive", () => {
  it("groups other weeks with shown signals and can exclude one week", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech({
        id: "cur",
        slug: "cur",
        publishDate: "2026-07-21",
        importanceLevel: "critical"
      }),
      tech({
        id: "prev-high",
        slug: "prev-high",
        publishDate: "2026-07-19",
        importanceLevel: "critical"
      }),
      tech({
        id: "prev-watch",
        slug: "prev-watch",
        publishDate: "2026-07-14",
        importanceLevel: "important"
      }),
      tech({
        id: "prev-low",
        slug: "prev-low",
        publishDate: "2026-07-15",
        importanceLevel: "signal"
      })
    ]);

    const archive = getWeeklyReviewArchive({ excludeWeekKey: "2026-07-20" });

    expect(archive).toHaveLength(1);
    expect(archive[0].weekKey).toBe("2026-07-13");
    expect(archive[0].highPriorityCount).toBe(1);
    expect(archive[0].watchCount).toBe(1);
    // low_priority "prev-low" is excluded from the count.
    expect(archive[0].totalCount).toBe(2);
  });
});

describe("getWeeklyReviewNeighbors", () => {
  // Shown signals in the weeks of 07-06, 07-20 (current) and 08-03 (future);
  // 07-13 has only a low_priority signal, so it is an empty week.
  beforeEach(() => {
    getAllTechnologiesMock.mockReturnValue([
      tech({
        id: "w0706",
        slug: "w0706",
        publishDate: "2026-07-08",
        importanceLevel: "important"
      }),
      tech({
        id: "w0713-low",
        slug: "w0713-low",
        publishDate: "2026-07-15",
        importanceLevel: "signal"
      }),
      tech({
        id: "w0720",
        slug: "w0720",
        publishDate: "2026-07-21",
        importanceLevel: "critical"
      }),
      tech({
        id: "w0803-future",
        slug: "w0803-future",
        publishDate: "2026-08-04",
        importanceLevel: "critical"
      })
    ]);
  });

  it("skips an empty week and never pages past the current week", () => {
    expect(getWeeklyReviewNeighbors("2026-07-20")).toEqual({
      previous: { weekKey: "2026-07-06", rangeLabel: "7 月 6 日 – 7 月 12 日" },
      next: undefined
    });
  });

  it("links the oldest week forward only", () => {
    expect(getWeeklyReviewNeighbors("2026-07-06")).toEqual({
      previous: undefined,
      next: { weekKey: "2026-07-20", rangeLabel: "7 月 20 日 – 7 月 26 日" }
    });
  });

  it("resolves neighbours for an empty week that is not itself listed", () => {
    expect(getWeeklyReviewNeighbors("2026-07-13")).toEqual({
      previous: { weekKey: "2026-07-06", rangeLabel: "7 月 6 日 – 7 月 12 日" },
      next: { weekKey: "2026-07-20", rangeLabel: "7 月 20 日 – 7 月 26 日" }
    });
  });
});
