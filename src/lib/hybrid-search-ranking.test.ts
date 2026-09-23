import { describe, expect, it } from "vitest";

import {
  fuseRankings,
  rankKeywordMatches,
  selectSemanticMatches,
  type RankableDocument,
  type ScoredDocument
} from "@/lib/hybrid-search-ranking";

function doc(
  key: string,
  titleText: string,
  body = "",
  group = "technologies"
): RankableDocument {
  return { key, group, titleText, haystack: `${titleText} ${body}` };
}

describe("rankKeywordMatches", () => {
  it("requires every term and puts title hits first", () => {
    const documents = [
      doc("a", "release notes", "mentions vllm once"),
      doc("b", "vllm v0.27.0", "inference engine"),
      doc("c", "unrelated", "nothing here")
    ];

    expect(rankKeywordMatches(documents, ["vllm"])).toEqual(["b", "a"]);
    expect(rankKeywordMatches(documents, ["vllm", "engine"])).toEqual(["b"]);
  });

  it("keeps original order among equal title hits", () => {
    const documents = [doc("a", "mcp one"), doc("b", "mcp two")];

    expect(rankKeywordMatches(documents, ["mcp"])).toEqual(["a", "b"]);
  });

  it("returns nothing for an empty query", () => {
    expect(rankKeywordMatches([doc("a", "anything")], [])).toEqual([]);
  });
});

function scored(key: string, score: number, group = "g1"): ScoredDocument {
  return { key, group, score };
}

describe("selectSemanticMatches", () => {
  // Nine background scores at 0.80 and one clear outlier: mean 0.81, sd 0.03,
  // so the outlier sits at z = 3 and the background at z = -0.33.
  const background = Array.from({ length: 9 }, (_, index) =>
    scored(`bg${index}`, 0.8)
  );

  it("keeps documents above the z threshold, best first", () => {
    const result = selectSemanticMatches([...background, scored("hit", 0.9)], {
      minZ: 2,
      perGroupLimit: 5
    });

    expect(result.get("g1")).toEqual(["hit"]);
  });

  it("is relative to the query, not an absolute cosine", () => {
    // The same shape shifted down by 0.1 — what an English query against a
    // mostly Chinese corpus looks like — keeps the same result.
    const shifted = [
      ...background.map((entry) => ({ ...entry, score: entry.score - 0.1 })),
      scored("hit", 0.8)
    ];

    expect(
      selectSemanticMatches(shifted, { minZ: 2, perGroupLimit: 5 }).get("g1")
    ).toEqual(["hit"]);
  });

  it("measures the threshold across all groups together", () => {
    const result = selectSemanticMatches(
      [
        ...background,
        scored("strong", 0.9, "g1"),
        scored("weak-in-other-group", 0.81, "g2")
      ],
      { minZ: 2, perGroupLimit: 5 }
    );

    expect(result.get("g1")).toEqual(["strong"]);
    expect(result.has("g2")).toBe(false);
  });

  it("caps each group", () => {
    const result = selectSemanticMatches(
      [
        ...background,
        ...background,
        scored("h1", 0.95),
        scored("h2", 0.94),
        scored("h3", 0.93)
      ],
      { minZ: 1, perGroupLimit: 2 }
    );

    expect(result.get("g1")).toEqual(["h1", "h2"]);
  });

  it("returns nothing when every score is equal", () => {
    expect(
      selectSemanticMatches(background, { minZ: 0, perGroupLimit: 5 }).size
    ).toBe(0);
  });
});

describe("fuseRankings", () => {
  it("ranks a document found by both lists above either alone", () => {
    const fused = fuseRankings(["a", "b"], ["c", "b"]);

    expect(fused[0]).toMatchObject({ key: "b", matchedBy: "both" });
    expect(fused.map((entry) => entry.key).sort()).toEqual(["a", "b", "c"]);
  });

  it("labels why each result is there", () => {
    const fused = fuseRankings(["a"], ["c"]);
    const reasons = Object.fromEntries(
      fused.map((entry) => [entry.key, entry.matchedBy])
    );

    expect(reasons).toEqual({ a: "keyword", c: "semantic" });
  });

  it("breaks a tie in favour of the keyword hit", () => {
    const fused = fuseRankings(["kw"], ["sem"]);

    expect(fused.map((entry) => entry.key)).toEqual(["kw", "sem"]);
  });

  it("is keyword-only when there is no semantic list", () => {
    const fused = fuseRankings(["a", "b"], []);

    expect(fused.map((entry) => [entry.key, entry.matchedBy])).toEqual([
      ["a", "keyword"],
      ["b", "keyword"]
    ]);
  });
});
