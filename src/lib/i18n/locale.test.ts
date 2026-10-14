import { describe, expect, it } from "vitest";

import {
  getLocaleAlternates,
  getPathLocale,
  hasEnglishTwin,
  localePath,
  stripLocalePrefix
} from "@/lib/i18n/locale";

describe("getPathLocale", () => {
  it("reads /en and everything under it as English", () => {
    expect(getPathLocale("/en")).toBe("en");
    expect(getPathLocale("/en/technologies/x")).toBe("en");
  });

  it("leaves every other path Chinese, including look-alikes", () => {
    expect(getPathLocale("/")).toBe("zh");
    expect(getPathLocale("/technologies")).toBe("zh");
    expect(getPathLocale("/english")).toBe("zh");
    expect(getPathLocale("/enterprise/en")).toBe("zh");
  });
});

describe("localePath / stripLocalePrefix", () => {
  it("prefixes English paths and keeps Chinese ones as they are", () => {
    expect(localePath("zh", "/technologies")).toBe("/technologies");
    expect(localePath("en", "/technologies")).toBe("/en/technologies");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/?q=a")).toBe("/en?q=a");
    expect(localePath("en", "/#top")).toBe("/en#top");
    expect(localePath("en", "/search?q=a#x")).toBe("/en/search?q=a#x");
  });

  it("leaves absolute and fragment-only addresses alone", () => {
    expect(localePath("en", "https://example.com/")).toBe(
      "https://example.com/"
    );
    expect(localePath("en", "#section")).toBe("#section");
  });

  it("round-trips through stripLocalePrefix", () => {
    for (const path of ["/", "/technologies", "/digest/weekly/2026-10-12"]) {
      expect(stripLocalePrefix(localePath("en", path))).toBe(path);
      expect(stripLocalePrefix(path)).toBe(path);
    }
    expect(stripLocalePrefix("/english")).toBe("/english");
  });

  it("gives both versions of a path", () => {
    expect(getLocaleAlternates("/radar")).toEqual({
      zh: "/radar",
      en: "/en/radar"
    });
  });
});

describe("hasEnglishTwin", () => {
  it("is true for public pages and false for the workspace, feeds and API", () => {
    expect(hasEnglishTwin("/")).toBe(true);
    expect(hasEnglishTwin("/technologies/x?view=news")).toBe(true);
    expect(hasEnglishTwin("/workspace")).toBe(false);
    expect(hasEnglishTwin("/workspace/sources")).toBe(false);
    expect(hasEnglishTwin("/technologies/drafts/1")).toBe(false);
    expect(hasEnglishTwin("/api/ask")).toBe(false);
    expect(hasEnglishTwin("/offline")).toBe(false);
    expect(hasEnglishTwin("/topics/tag-ai-agents/feed.xml")).toBe(false);
  });
});
