import { describe, expect, it } from "vitest";

import {
  englishBodyMinLength,
  getPreferredTechnologyText,
  getTechnologyBodyForLocale,
  getTechnologyTextForLocale,
  getTechnologyTextForMode
} from "@/lib/technology-localization";
import { formatWeekRange, formatWeekRangeFromKey } from "@/lib/week-range";
import type { LocalizedText, TechnologyItem } from "@/types/content";

const englishArticle = "An English article. ".repeat(40);

function signal(overrides: Partial<TechnologyItem>): TechnologyItem {
  return {
    id: "t",
    slug: "t",
    status: "published",
    sourceLanguage: "en",
    translationStatus: "full",
    title: { original: "Original title", zh: "中文标题" },
    summary: { original: "Original summary.", zh: "中文摘要。" },
    content: { original: "See the release notes.", zh: "中文正文。" },
    type: "model",
    publishDate: "2026-10-13",
    sourceName: "Source",
    sourceUrl: "https://example.com",
    publisherName: "Publisher",
    publisherType: "startup",
    importanceLevel: "important",
    tags: [],
    relatedKnowledgeIds: [],
    relatedSkillIds: [],
    ...overrides
  } as TechnologyItem;
}

describe("getTechnologyTextForLocale", () => {
  it("leaves the Chinese site exactly as getPreferredTechnologyText", () => {
    const value: LocalizedText = { original: "Hello", zh: "你好" };

    expect(getTechnologyTextForLocale(value, "en", "zh").text).toBe(
      getPreferredTechnologyText(value, "en")
    );
  });

  it("prefers the en field, then an English original, then Chinese", () => {
    expect(
      getTechnologyTextForLocale(
        { original: "Orig", zh: "中", en: "English" },
        "en",
        "en"
      )
    ).toEqual({ text: "English", language: "en" });
    expect(
      getTechnologyTextForLocale({ original: "Orig", zh: "中" }, "en", "en")
    ).toEqual({ text: "Orig", language: "en" });
    expect(
      getTechnologyTextForLocale({ original: "原文", zh: "中文" }, "zh", "en")
    ).toEqual({ text: "中文", language: "zh" });
  });

  it("shows Chinese in 中文 mode on the English site", () => {
    expect(
      getTechnologyTextForMode(
        { original: "Orig", zh: "中文" },
        "zh",
        "en",
        "en"
      )
    ).toEqual({ text: "中文", language: "zh" });
  });
});

describe("getTechnologyBodyForLocale", () => {
  it("uses the English body only when it is a real article", () => {
    const long = signal({
      content: { original: englishArticle, zh: "中文正文。" }
    });
    const body = getTechnologyBodyForLocale(long, "original", "en");

    expect(englishArticle.trim().length).toBeGreaterThanOrEqual(
      englishBodyMinLength
    );
    expect(body.language).toBe("en");
    expect(body.isChineseWriteUp).toBe(false);
  });

  it("falls back to the Chinese write-up for an excerpt, and says so", () => {
    const body = getTechnologyBodyForLocale(signal({}), "original", "en");

    expect(body).toEqual({
      text: "中文正文。",
      language: "zh",
      isChineseWriteUp: true
    });
  });

  it("follows the reading mode on the Chinese site", () => {
    const item = signal({});

    expect(getTechnologyBodyForLocale(item, "zh", "zh").text).toBe(
      "中文正文。"
    );
    expect(getTechnologyBodyForLocale(item, "original", "zh").text).toBe(
      "See the release notes."
    );
  });
});

describe("formatWeekRange", () => {
  it("names the week in either language", () => {
    expect(formatWeekRange("2026-10-05", "2026-10-11")).toBe(
      "10 月 5 日 – 10 月 11 日"
    );
    expect(formatWeekRangeFromKey("2026-10-05", "en")).toBe("Oct 5 – Oct 11");
    expect(formatWeekRangeFromKey("2026-12-28", "en")).toBe("Dec 28 – Jan 3");
  });
});
