import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSignalDigestAppearances,
  findSignalWeeklyAppearance,
  getSignalIssueAppearances
} from "@/lib/signal-digest-appearances";
import { makeTechnologyItem } from "@/lib/test-factories";
import type {
  DailyDigest,
  PriorityLevel,
  TechnologyItem,
  TechnologyPriorityRanking
} from "@/types/content";

const mocks = vi.hoisted(() => ({
  getAllTechnologies: vi.fn<() => TechnologyItem[]>(),
  getDailyDigests: vi.fn<() => DailyDigest[]>(),
  getTodayDateString: vi.fn<() => string>(),
  evaluateTechnologyPriority:
    vi.fn<(technology: TechnologyItem) => TechnologyPriorityRanking>()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: mocks.getAllTechnologies
}));

vi.mock("@/lib/ranking", () => ({
  evaluateTechnologyPriority: mocks.evaluateTechnologyPriority
}));

vi.mock("@/lib/digest-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/digest-store")>()),
  getTodayDateString: mocks.getTodayDateString
}));

vi.mock("@/lib/digest-workflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/digest-workflow")>()),
  getDailyDigests: mocks.getDailyDigests
}));

// The level is read off importanceLevel, so each test states what Ranking v0
// would say without depending on its scoring.
const levelByImportance: Record<
  TechnologyItem["importanceLevel"],
  PriorityLevel
> = {
  critical: "high_priority",
  important: "watch",
  signal: "low_priority"
};

function ranking(technology: TechnologyItem): TechnologyPriorityRanking {
  return {
    priorityLevel: levelByImportance[technology.importanceLevel],
    priorityScore: 50,
    priorityReasons: [],
    priorityWarnings: [],
    rankingUpdatedAt: "2026-09-01T00:00:00.000Z",
    rankingSource: "rule_based"
  };
}

function makeDigest(overrides: Partial<DailyDigest>): DailyDigest {
  const ts = "2026-09-01T12:00:00.000Z";
  return {
    id: `digest-${overrides.date ?? "2026-09-01"}`,
    date: "2026-09-01",
    status: "published",
    title: "AI 技术简报 · 本期",
    summary: "",
    editorialSummary: "",
    highPriorityTechnologyIds: [],
    watchTechnologyIds: [],
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: [],
    skillIds: [],
    knowledgeIds: [],
    sourceNames: [],
    generatedAt: ts,
    updatedAt: ts,
    editorialNotes: ["内部备注，不能外泄"],
    ...overrides
  };
}

const signal = makeTechnologyItem({
  id: "sig",
  slug: "sig",
  status: "published",
  publishDate: "2026-09-24",
  importanceLevel: "important"
});
const other = makeTechnologyItem({
  id: "other",
  slug: "other",
  status: "published",
  publishDate: "2026-09-23",
  importanceLevel: "critical"
});
const technologies = [signal, other];

beforeEach(() => {
  mocks.evaluateTechnologyPriority.mockImplementation(ranking);
  mocks.getAllTechnologies.mockReturnValue(technologies);
  mocks.getTodayDateString.mockReturnValue("2026-10-01");
  mocks.getDailyDigests.mockReturnValue([]);
});

describe("buildSignalDigestAppearances", () => {
  it("lists published digests carrying the signal, newest first, with their section", () => {
    const appearances = buildSignalDigestAppearances(
      "sig",
      [
        makeDigest({ date: "2026-09-20", watchTechnologyIds: ["sig"] }),
        makeDigest({
          date: "2026-09-28",
          title: "九月底的简报",
          highPriorityTechnologyIds: ["sig"]
        }),
        makeDigest({ date: "2026-09-25", watchTechnologyIds: ["other"] })
      ],
      technologies
    );

    expect(appearances).toEqual([
      {
        date: "2026-09-28",
        title: "九月底的简报",
        section: "high_priority",
        href: "/digest/2026-09-28"
      },
      {
        date: "2026-09-20",
        title: "AI 技术简报 · 本期",
        section: "watch",
        href: "/digest/2026-09-20"
      }
    ]);
  });

  it("skips draft and archived digests", () => {
    expect(
      buildSignalDigestAppearances(
        "sig",
        [
          makeDigest({
            date: "2026-09-20",
            status: "draft",
            watchTechnologyIds: ["sig"]
          }),
          makeDigest({
            date: "2026-09-21",
            status: "archived",
            watchTechnologyIds: ["sig"]
          })
        ],
        technologies
      )
    ).toEqual([]);
  });

  it("follows the page's editorial controls: excluded out, manual additions and pins in", () => {
    const byDate = buildSignalDigestAppearances(
      "sig",
      [
        makeDigest({
          date: "2026-09-20",
          watchTechnologyIds: ["sig"],
          excludedTechnologyIds: ["sig"]
        }),
        makeDigest({
          date: "2026-09-21",
          manuallyAddedTechnologyIds: ["sig"]
        }),
        makeDigest({
          date: "2026-09-22",
          watchTechnologyIds: ["sig"],
          pinnedTechnologyIds: ["sig"]
        })
      ],
      technologies
    ).map(({ date, section }) => ({ date, section }));

    expect(byDate).toEqual([
      { date: "2026-09-22", section: "high_priority" },
      { date: "2026-09-21", section: "watch" }
    ]);
  });

  it("ignores an id that is not a published technology", () => {
    expect(
      buildSignalDigestAppearances(
        "sig",
        [makeDigest({ date: "2026-09-20", watchTechnologyIds: ["sig"] })],
        [other]
      )
    ).toEqual([]);
  });

  it("uses the first digest stored for a date, as /digest/[date] does", () => {
    expect(
      buildSignalDigestAppearances(
        "sig",
        [
          makeDigest({
            date: "2026-09-20",
            status: "draft",
            watchTechnologyIds: ["sig"]
          }),
          makeDigest({ date: "2026-09-20", watchTechnologyIds: ["sig"] })
        ],
        technologies
      )
    ).toEqual([]);
  });

  it("cleans the title like the digest page and carries no internal fields", () => {
    const [appearance] = buildSignalDigestAppearances(
      "sig",
      [
        makeDigest({
          date: "2026-09-20",
          title: "mock validation digest",
          watchTechnologyIds: ["sig"]
        })
      ],
      technologies
    );

    expect(appearance.title).toBe("AI 技术简报 · 2026-09-20");
    expect(Object.keys(appearance).sort()).toEqual([
      "date",
      "href",
      "section",
      "title"
    ]);
    expect(JSON.stringify(appearance)).not.toContain("内部备注");
  });
});

describe("findSignalWeeklyAppearance", () => {
  it("links the review of the signal's week with the level it shows it at", () => {
    expect(findSignalWeeklyAppearance(signal)).toEqual({
      weekKey: "2026-09-21",
      rangeLabel: "9 月 21 日 – 9 月 27 日",
      section: "watch",
      href: "/digest/weekly/2026-09-21"
    });
  });

  it("links nothing for a signal the weekly review leaves out", () => {
    const quiet = makeTechnologyItem({
      id: "quiet",
      slug: "quiet",
      publishDate: "2026-09-24",
      importanceLevel: "signal"
    });
    mocks.getAllTechnologies.mockReturnValue([...technologies, quiet]);

    expect(findSignalWeeklyAppearance(quiet)).toBeUndefined();
  });

  it("links nothing for an unparseable publish date", () => {
    expect(
      findSignalWeeklyAppearance({ slug: "sig", publishDate: "2026-02-30" })
    ).toBeUndefined();
  });
});

describe("getSignalIssueAppearances", () => {
  it("returns nothing for a draft", () => {
    mocks.getDailyDigests.mockReturnValue([
      makeDigest({ date: "2026-09-20", watchTechnologyIds: ["sig"] })
    ]);

    expect(
      getSignalIssueAppearances({ ...signal, status: "draft" })
    ).toBeUndefined();
  });

  it("returns nothing for a signal no digest carried, even with a weekly review", () => {
    expect(findSignalWeeklyAppearance(signal)).toBeDefined();
    expect(getSignalIssueAppearances(signal)).toBeUndefined();
  });

  it("combines the digests and the week", () => {
    mocks.getDailyDigests.mockReturnValue([
      makeDigest({ date: "2026-09-28", watchTechnologyIds: ["sig"] })
    ]);

    const result = getSignalIssueAppearances(signal);

    expect(result?.digests.map((item) => item.date)).toEqual(["2026-09-28"]);
    expect(result?.weekly?.weekKey).toBe("2026-09-21");
  });
});
