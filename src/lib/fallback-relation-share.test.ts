import { describe, expect, it } from "vitest";

import { getContentGraph } from "@/lib/content";
import {
  computeFallbackRelationPercent,
  getFallbackRelationPercent
} from "@/lib/fallback-relation-share";
import type { RelationType } from "@/types/content";

const edges = (types: RelationType[]) =>
  types.map((relationType) => ({ relationType }));

describe("computeFallbackRelationPercent", () => {
  it("is the share of related-to edges, rounded to a whole percent", () => {
    expect(
      computeFallbackRelationPercent(
        edges(["related-to", "uses", "explains", "supports", "uses", "uses"])
      )
    ).toBe(17);
    // 1 of 16 = 6.25% → 6; 1 of 8 = 12.5% → 13 (Math.round rounds half up)
    expect(
      computeFallbackRelationPercent(
        edges(["related-to", ...Array<RelationType>(15).fill("uses")])
      )
    ).toBe(6);
    expect(
      computeFallbackRelationPercent(
        edges(["related-to", ...Array<RelationType>(7).fill("uses")])
      )
    ).toBe(13);
  });

  it("is 0 for no edges and for a graph with no fallback edge", () => {
    expect(computeFallbackRelationPercent([])).toBe(0);
    expect(computeFallbackRelationPercent(edges(["uses", "requires"]))).toBe(0);
  });
});

describe("getFallbackRelationPercent", () => {
  it("counts the edges /network draws", () => {
    const graph = getContentGraph().edges;
    const expected = Math.round(
      (graph.filter((edge) => edge.relationType === "related-to").length /
        graph.length) *
        100
    );

    expect(graph.length).toBeGreaterThan(0);
    expect(getFallbackRelationPercent()).toBe(expected);
  });
});
