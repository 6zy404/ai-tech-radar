import { describe, expect, it } from "vitest";

import type {
  HybridSearchResultLink,
  HybridSearchResults
} from "@/lib/hybrid-search";
import type { PublicNewsItem } from "@/lib/news";
import {
  buildSearchHref,
  filterSearchResults,
  getSearchTypeCounts,
  hasOnlySemanticMatches,
  parseSearchType
} from "@/lib/search-filter";

function link(
  key: string,
  matchedBy: HybridSearchResultLink["matchedBy"] = "keyword"
): HybridSearchResultLink {
  return { key, title: key, href: `/x/${key}`, tags: [], matchedBy };
}

function news(key: string): PublicNewsItem {
  return {
    key,
    title: key,
    sourceName: "src",
    sourceUrl: `https://example.com/${key}`,
    publishDate: "2026-09-29",
    tags: []
  };
}

function results(
  overrides: Partial<HybridSearchResults> = {}
): HybridSearchResults {
  const base: HybridSearchResults = {
    query: "agent",
    terms: ["agent"],
    technologies: [link("t1"), link("t2")],
    skills: [link("s1")],
    knowledge: [],
    news: [news("n1"), news("n2"), news("n3")],
    totalCount: 6,
    semanticAvailable: true
  };

  return { ...base, ...overrides };
}

describe("parseSearchType", () => {
  it("accepts the four group ids", () => {
    expect(parseSearchType("technologies")).toBe("technologies");
    expect(parseSearchType("skills")).toBe("skills");
    expect(parseSearchType("knowledge")).toBe("knowledge");
    expect(parseSearchType("news")).toBe("news");
  });

  it("reads anything else as no filter", () => {
    expect(parseSearchType(undefined)).toBeUndefined();
    expect(parseSearchType("")).toBeUndefined();
    expect(parseSearchType("signal")).toBeUndefined();
    expect(parseSearchType("News")).toBeUndefined();
    expect(parseSearchType("constructor")).toBeUndefined();
    expect(parseSearchType(["news", "skills"])).toBeUndefined();
  });
});

describe("getSearchTypeCounts", () => {
  it("counts every group, including empty ones", () => {
    expect(getSearchTypeCounts(results())).toEqual({
      technologies: 2,
      skills: 1,
      knowledge: 0,
      news: 3
    });
  });
});

describe("filterSearchResults", () => {
  it("returns the results unchanged without a type", () => {
    const all = results();
    expect(filterSearchResults(all, undefined)).toBe(all);
  });

  it("keeps only the chosen group and leaves the total alone", () => {
    const filtered = filterSearchResults(results(), "news");
    expect(filtered.technologies).toEqual([]);
    expect(filtered.skills).toEqual([]);
    expect(filtered.knowledge).toEqual([]);
    expect(filtered.news.map((item) => item.key)).toEqual(["n1", "n2", "n3"]);
    expect(filtered.totalCount).toBe(6);
  });

  it("does not change the counts, which come from the unfiltered results", () => {
    const all = results();
    filterSearchResults(all, "skills");
    expect(getSearchTypeCounts(all).technologies).toBe(2);
  });
});

describe("hasOnlySemanticMatches", () => {
  const semanticOnly = results({
    technologies: [link("t1", "semantic")],
    skills: [link("s1", "semantic")],
    news: []
  });

  it("is true when every graph result came from meaning alone", () => {
    expect(hasOnlySemanticMatches(semanticOnly)).toBe(true);
  });

  it("is false when a news result matched literally", () => {
    expect(hasOnlySemanticMatches(results())).toBe(false);
  });

  it("is judged on the visible group once filtered", () => {
    const mixed = results({
      technologies: [link("t1", "semantic")],
      skills: [link("s1", "both")]
    });
    expect(hasOnlySemanticMatches(mixed)).toBe(false);
    expect(
      hasOnlySemanticMatches(filterSearchResults(mixed, "technologies"))
    ).toBe(true);
    expect(hasOnlySemanticMatches(filterSearchResults(mixed, "news"))).toBe(
      false
    );
  });
});

describe("buildSearchHref", () => {
  it("encodes the query and adds the type only when given", () => {
    expect(buildSearchHref("上下文 agent")).toBe(
      "/search?q=%E4%B8%8A%E4%B8%8B%E6%96%87+agent"
    );
    expect(buildSearchHref("a&b", "skills")).toBe(
      "/search?q=a%26b&type=skills"
    );
  });
});
