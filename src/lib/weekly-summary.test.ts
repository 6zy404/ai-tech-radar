import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeTechnologyItem } from "@/lib/test-factories";
import {
  getWeeklyFeedWeeks,
  renderWeeklyReviewRssXml
} from "@/lib/weekly-feed";
import {
  getPublishedWeeklySummaryText,
  getWeeklySummary,
  saveWeeklySummaryText,
  setWeeklySummaryStatus,
  WeeklySummaryError,
  type WeeklySummaryRecord
} from "@/lib/weekly-summary";
import type {
  TechnologyItem,
  TechnologyPriorityRanking
} from "@/types/content";

const { getAllTechnologiesMock } = vi.hoisted(() => ({
  getAllTechnologiesMock: vi.fn<() => TechnologyItem[]>()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: getAllTechnologiesMock
}));

vi.mock("@/lib/digest-store", () => ({
  getTodayDateString: () => "2026-10-14"
}));

vi.mock("@/lib/ranking", () => ({
  evaluateTechnologyPriority: (): TechnologyPriorityRanking => ({
    priorityLevel: "high_priority",
    priorityScore: 80,
    priorityReasons: [],
    priorityWarnings: [],
    rankingUpdatedAt: "2026-10-14T00:00:00.000Z",
    rankingSource: "rule_based"
  })
}));

// Monday of the week holding 2026-10-14; the week before has no signal.
const week = "2026-10-12";
const emptyWeek = "2026-10-05";

let dataDir = "";
let previousDataDir: string | undefined;

beforeEach(() => {
  previousDataDir = process.env.LOCAL_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "weekly-summary-"));
  process.env.LOCAL_DATA_DIR = dataDir;
  getAllTechnologiesMock.mockReturnValue([
    makeTechnologyItem({
      id: "vista",
      slug: "vista",
      publishDate: "2026-10-13",
      importanceLevel: "critical"
    })
  ]);
});

afterEach(() => {
  if (previousDataDir === undefined) {
    delete process.env.LOCAL_DATA_DIR;
  } else {
    process.env.LOCAL_DATA_DIR = previousDataDir;
  }

  rmSync(dataDir, { recursive: true, force: true });
});

describe("weekly summary store", () => {
  it("saves a new summary as a draft that readers cannot see", () => {
    const record = saveWeeklySummaryText(
      week,
      "这一周的**两条**信号。\n\n\n\n第二段。"
    );

    expect(record).toMatchObject({
      weekKey: week,
      status: "draft",
      text: "这一周的**两条**信号。\n\n第二段。"
    });
    expect(getPublishedWeeklySummaryText(week)).toBeUndefined();
  });

  it("shows only a published summary, and stops when it is taken back", () => {
    saveWeeklySummaryText(week, "编辑写的本周总结。");
    setWeeklySummaryStatus(week, "published");

    expect(getPublishedWeeklySummaryText(week)).toBe("编辑写的本周总结。");
    expect(getWeeklySummary(week)?.publishedAt).toBeTruthy();

    setWeeklySummaryStatus(week, "draft");
    expect(getPublishedWeeklySummaryText(week)).toBeUndefined();
  });

  it("keeps a published summary published when its text is edited", () => {
    saveWeeklySummaryText(week, "第一版。");
    setWeeklySummaryStatus(week, "published");
    saveWeeklySummaryText(week, "第二版。");

    expect(getPublishedWeeklySummaryText(week)).toBe("第二版。");
  });

  it("refuses to publish text the public page would hide", () => {
    saveWeeklySummaryText(week, "这是 mock 文字。");

    expect(() => setWeeklySummaryStatus(week, "published")).toThrow(
      WeeklySummaryError
    );
    expect(getWeeklySummary(week)?.status).toBe("draft");
  });

  it("only accepts a canonical Monday of a week with signals", () => {
    expect(() => saveWeeklySummaryText("2026-10-13", "x")).toThrow(
      "周一的日期"
    );
    expect(() => saveWeeklySummaryText(emptyWeek, "x")).toThrow(
      "没有展示的信号"
    );
  });
});

describe("weekly review RSS with summaries", () => {
  const record = (status: WeeklySummaryRecord["status"]) => ({
    weekKey: week,
    status,
    text: "**编辑**写的本周总结。",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z"
  });

  it("carries a published summary as plain text", () => {
    const xml = renderWeeklyReviewRssXml(
      getWeeklyFeedWeeks(),
      "https://x.dev",
      [record("published")]
    );

    expect(xml).toContain("本周总结：编辑写的本周总结。");
  });

  it("leaves a draft summary out", () => {
    const xml = renderWeeklyReviewRssXml(
      getWeeklyFeedWeeks(),
      "https://x.dev",
      [record("draft")]
    );

    expect(xml).not.toContain("本周总结：");
    expect(xml).not.toContain("编辑写的本周总结");
  });
});

describe("weekly summary store under the SQLite driver", () => {
  it("round-trips through runtime_configs, not a JSON file", async () => {
    const previousDriver = process.env.PERSISTENCE_DRIVER;
    process.env.PERSISTENCE_DRIVER = "sqlite";

    try {
      saveWeeklySummaryText(week, "SQLite 里的本周总结。");
      setWeeklySummaryStatus(week, "published");

      expect(getPublishedWeeklySummaryText(week)).toBe("SQLite 里的本周总结。");
      const { readdirSync } = await import("node:fs");
      expect(readdirSync(dataDir)).not.toContain("weekly-summaries.json");
    } finally {
      if (previousDriver === undefined) {
        delete process.env.PERSISTENCE_DRIVER;
      } else {
        process.env.PERSISTENCE_DRIVER = previousDriver;
      }
    }
  });
});
