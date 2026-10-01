import { describe, expect, it } from "vitest";

import {
  buildLibraryFilterText,
  filterLibraryGroups,
  librarySearchHref,
  matchesLibraryFilter,
  normalizeLibraryQuery,
  parseLibraryFilterQuery,
  parseLibraryFilterTerms,
  withLibraryFilterQuery
} from "@/lib/library-filter";
import { normalizeSearchQuery } from "@/lib/search";

const groups = [
  {
    id: "engineering",
    items: [
      {
        id: "rag",
        text: buildLibraryFilterText([
          "检索流水线调优",
          "Tune a RAG pipeline end to end.",
          "RAG",
          "工程落地"
        ])
      },
      {
        id: "evals",
        text: buildLibraryFilterText([
          "Agent 评测",
          "Build evals for agents.",
          "Agents",
          "工程落地"
        ])
      }
    ]
  },
  {
    id: "product",
    items: [
      {
        id: "scope",
        text: buildLibraryFilterText([
          "范围界定",
          "Decide what an agent should own.",
          undefined,
          "产品判断"
        ])
      }
    ]
  }
];

describe("normalizeLibraryQuery", () => {
  it.each([
    [undefined],
    [""],
    ["   "],
    ["  RAG  "],
    ["agent\t\tevals"],
    ["检索  流水线\n调优"]
  ])("normalises %j exactly as /search does", (raw) => {
    expect(normalizeLibraryQuery(raw)).toBe(normalizeSearchQuery(raw));
  });
});

describe("parseLibraryFilterTerms", () => {
  it("splits on whitespace and lower-cases", () => {
    expect(parseLibraryFilterTerms("  RAG   Pipeline ")).toEqual([
      "rag",
      "pipeline"
    ]);
  });

  it("has no terms for a blank query", () => {
    expect(parseLibraryFilterTerms("   ")).toEqual([]);
  });
});

describe("buildLibraryFilterText", () => {
  it("joins the non-empty parts in lower case", () => {
    expect(buildLibraryFilterText(["A", undefined, " ", "Bc"])).toBe("a bc");
  });
});

describe("matchesLibraryFilter", () => {
  const text = buildLibraryFilterText([
    "Agent 评测",
    "Build evals",
    "工程落地"
  ]);

  it("ignores case", () => {
    expect(matchesLibraryFilter(text, parseLibraryFilterTerms("AGENT"))).toBe(
      true
    );
  });

  it("needs every term", () => {
    expect(
      matchesLibraryFilter(text, parseLibraryFilterTerms("agent evals"))
    ).toBe(true);
    expect(
      matchesLibraryFilter(text, parseLibraryFilterTerms("agent rag"))
    ).toBe(false);
  });

  it("matches Chinese substrings", () => {
    expect(matchesLibraryFilter(text, parseLibraryFilterTerms("落地"))).toBe(
      true
    );
  });

  it("matches everything with no terms", () => {
    expect(matchesLibraryFilter(text, [])).toBe(true);
  });
});

describe("filterLibraryGroups", () => {
  it("keeps every group and entry for an empty query", () => {
    const result = filterLibraryGroups(groups, "");

    expect(result.groups.map((group) => group.id)).toEqual([
      "engineering",
      "product"
    ]);
    expect(result.matchCount).toBe(3);
    expect(result.totalCount).toBe(3);
  });

  it("drops a group left with no entries", () => {
    const result = filterLibraryGroups(groups, "rag");

    expect(result.groups.map((group) => group.id)).toEqual(["engineering"]);
    expect(result.groups[0].items.map((item) => item.id)).toEqual(["rag"]);
    expect(result.matchCount).toBe(1);
    expect(result.totalCount).toBe(3);
  });

  it("matches the category an entry is filed under", () => {
    const result = filterLibraryGroups(groups, "产品判断");

    expect(result.groups.map((group) => group.id)).toEqual(["product"]);
  });

  it("keeps entry order across groups", () => {
    const result = filterLibraryGroups(groups, "agent");

    expect(
      result.groups.flatMap((group) => group.items.map((item) => item.id))
    ).toEqual(["evals", "scope"]);
  });

  it("returns no groups when nothing matches", () => {
    const result = filterLibraryGroups(groups, "quantum");

    expect(result.groups).toEqual([]);
    expect(result.matchCount).toBe(0);
  });

  it("does not mutate its input", () => {
    filterLibraryGroups(groups, "rag");

    expect(groups[0].items).toHaveLength(2);
  });
});

describe("parseLibraryFilterQuery", () => {
  it("reads a string", () => {
    expect(parseLibraryFilterQuery("rag")).toBe("rag");
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseLibraryFilterQuery(["rag", "agent"])).toBe("rag");
  });

  it.each([[undefined], [""], ["   "], ["x".repeat(201)]])(
    "reads %j as no filter",
    (value) => {
      expect(parseLibraryFilterQuery(value)).toBe("");
    }
  );
});

describe("withLibraryFilterQuery", () => {
  it("writes q", () => {
    expect(withLibraryFilterQuery("http://x/skills", "rag 评测")).toBe(
      "/skills?q=rag+%E8%AF%84%E6%B5%8B"
    );
  });

  it("removes q for a blank filter", () => {
    expect(withLibraryFilterQuery("http://x/skills?q=rag", "  ")).toBe(
      "/skills"
    );
  });

  it("keeps other parameters and the hash", () => {
    expect(
      withLibraryFilterQuery("http://x/knowledge?utm=a&q=old#top", "new")
    ).toBe("/knowledge?utm=a&q=new#top");
  });
});

describe("librarySearchHref", () => {
  it("narrows /search to the page's kind", () => {
    expect(librarySearchHref("knowledge", "  rag  pipeline ")).toBe(
      "/search?q=rag+pipeline&type=knowledge"
    );
  });
});
