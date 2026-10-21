import { XMLValidator } from "fast-xml-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTechnologyItem } from "@/lib/test-factories";
import {
  getWeeklyFeedWeeks,
  renderWeeklyReviewRssXml
} from "@/lib/weekly-feed";
import type {
  PriorityLevel,
  TechnologyItem,
  TechnologyPriorityRanking
} from "@/types/content";

const { getAllTechnologiesMock, getTodayDateStringMock } = vi.hoisted(() => ({
  getAllTechnologiesMock: vi.fn<() => TechnologyItem[]>(),
  getTodayDateStringMock: vi.fn<() => string>()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: getAllTechnologiesMock
}));

vi.mock("@/lib/digest-store", () => ({
  getTodayDateString: getTodayDateStringMock
}));

const levelByImportance: Record<
  TechnologyItem["importanceLevel"],
  PriorityLevel
> = {
  critical: "high_priority",
  important: "watch",
  signal: "low_priority"
};

vi.mock("@/lib/ranking", () => ({
  evaluateTechnologyPriority: (
    technology: TechnologyItem
  ): TechnologyPriorityRanking => ({
    priorityLevel: levelByImportance[technology.importanceLevel],
    priorityScore: 50,
    priorityReasons: [],
    priorityWarnings: [],
    rankingUpdatedAt: "2026-07-22T00:00:00.000Z",
    rankingSource: "rule_based"
  })
}));

const baseUrl = "https://radar.example";

function tech(
  id: string,
  publishDate: string,
  importanceLevel: TechnologyItem["importanceLevel"],
  title = `Signal ${id}`
): TechnologyItem {
  return makeTechnologyItem({
    id,
    slug: id,
    publishDate,
    importanceLevel,
    status: "published",
    sourceLanguage: "zh",
    translationStatus: "not_needed",
    title: { original: title, zh: title }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Wednesday: current natural week is Mon 2026-07-20 .. Sun 2026-07-26.
  getTodayDateStringMock.mockReturnValue("2026-07-22");
});

describe("getWeeklyFeedWeeks", () => {
  it("returns weeks with shown signals, newest first, up to the current week", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech("old", "2026-07-07", "critical"),
      tech("now", "2026-07-21", "important"),
      tech("future", "2026-07-29", "critical"),
      tech("low-only", "2026-07-14", "signal")
    ]);

    const weeks = getWeeklyFeedWeeks();

    // 2026-07-27 is a future week; 2026-07-13 has only a low_priority signal.
    expect(weeks.map((week) => week.weekKey)).toEqual([
      "2026-07-20",
      "2026-07-06"
    ]);
  });

  it("caps the number of weeks", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech("a", "2026-07-21", "critical"),
      tech("b", "2026-07-14", "critical"),
      tech("c", "2026-07-07", "critical")
    ]);

    expect(getWeeklyFeedWeeks(2).map((week) => week.weekKey)).toEqual([
      "2026-07-20",
      "2026-07-13"
    ]);
  });
});

describe("renderWeeklyReviewRssXml", () => {
  it("renders one item per week linking to its weekly-review page", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech("hot", "2026-07-21", "critical", "Hot signal"),
      tech("calm", "2026-07-23", "important", "Calm signal"),
      tech("earlier", "2026-07-08", "important", "Earlier signal")
    ]);

    const xml = renderWeeklyReviewRssXml(getWeeklyFeedWeeks(), baseUrl);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<title>本周回顾 · 2026-07-20 这一周</title>");
    expect(xml).toContain(`<link>${baseUrl}/digest/weekly/2026-07-20</link>`);
    expect(xml).toContain(
      `<guid isPermaLink="true">${baseUrl}/digest/weekly/2026-07-06</guid>`
    );
    expect(xml).toContain("立即关注：Hot signal");
    expect(xml).toContain("值得跟踪：Calm signal");
    expect(xml).toContain("立即关注：无");
    // pubDate is the week's latest signal date, not the week start.
    expect(xml).toContain("<pubDate>Thu, 23 Jul 2026 12:00:00 GMT</pubDate>");
    expect(xml).toContain(`<source url="${baseUrl}/digest/weekly/feed.xml">`);
    expect(xml).toContain("<language>zh-cn</language>");
    expect(xml).toContain(
      `<atom:link href="${baseUrl}/digest/weekly/feed.xml" rel="self" type="application/rss+xml"/>`
    );
    expect(XMLValidator.validate(xml)).toBe(true);
    // Newest week first.
    expect(xml.indexOf("2026-07-20 这一周")).toBeLessThan(
      xml.indexOf("2026-07-06 这一周")
    );
  });

  it("escapes XML special characters in signal titles", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech("x", "2026-07-21", "critical", `A <b> & "B" 's`)
    ]);

    const xml = renderWeeklyReviewRssXml(getWeeklyFeedWeeks(), baseUrl);

    expect(xml).toContain("A &lt;b&gt; &amp; &quot;B&quot; &apos;s");
    expect(xml).not.toContain("<b>");
    expect(xml).not.toContain('"B"');
  });

  it("keeps internal fields out of the feed", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech("x", "2026-07-21", "critical")
    ]);

    const xml = renderWeeklyReviewRssXml(getWeeklyFeedWeeks(), baseUrl);

    for (const field of [
      "priorityScore",
      "rawPayload",
      "importStatus",
      "editorialNotes",
      "intelligenceStatus"
    ]) {
      expect(xml).not.toContain(field);
    }
  });

  it("renders a valid empty channel when no week has signals", () => {
    getAllTechnologiesMock.mockReturnValue([]);

    const xml = renderWeeklyReviewRssXml(getWeeklyFeedWeeks(), baseUrl);

    expect(xml).not.toContain("<item>");
    expect(xml).toContain(`<link>${baseUrl}/digest/weekly</link>`);
    expect(xml.trim().endsWith("</rss>")).toBe(true);
  });
});
