import { describe, expect, it } from "vitest";

import type { ContentGraphData, ContentGraphEdge } from "@/lib/content";
import {
  buildTopicGraph,
  estimateFootprint,
  getRelationFamily,
  layoutTopicGraph,
  MAX_NODES,
  MAX_TOPIC_NODES,
  relationFamilyOrder,
  relationFamilyTypes,
  separateFootprints
} from "@/lib/topic-graph";
import type { RelationType } from "@/types/content";

function node(id: string) {
  return {
    id,
    title: id,
    href: `/technologies/${id}`,
    kind: "technology" as const
  };
}

function edge(
  sourceId: string,
  targetId: string,
  relationType: RelationType = "related-to"
): ContentGraphEdge {
  return { id: `${sourceId}--${targetId}`, sourceId, targetId, relationType };
}

function graphOf(ids: string[], edges: ContentGraphEdge[]): ContentGraphData {
  return { nodes: ids.map(node), edges };
}

describe("buildTopicGraph", () => {
  it("keeps a small topic whole, with every neighbour that links to it", () => {
    const graph = graphOf(
      ["a", "b", "n1", "n2", "far"],
      [edge("a", "b"), edge("a", "n1"), edge("n2", "b"), edge("n1", "far")]
    );
    const result = buildTopicGraph(new Set(["a", "b"]), graph);

    expect(result.nodes.map((item) => [item.id, item.inTopic])).toEqual([
      ["a", true],
      ["b", true],
      ["n1", false],
      ["n2", false]
    ]);
    // n1–far is not drawn: far is two steps out.
    expect(result.edges.map((item) => item.id)).toEqual([
      "a--b",
      "a--n1",
      "n2--b"
    ]);
    expect(result.topicNodeTotal).toBe(2);
    expect(result.neighborTotal).toBe(2);
  });

  it("caps a large topic at its best-connected items and fills up with neighbours", () => {
    const topicIds = Array.from({ length: 30 }, (_, index) => `t${index}`);
    const neighborIds = Array.from({ length: 20 }, (_, index) => `n${index}`);
    const edges: ContentGraphEdge[] = [];

    // t0..t4 form a clique: the topic's hubs.
    for (let i = 0; i < 5; i += 1) {
      for (let j = i + 1; j < 5; j += 1) {
        edges.push(edge(`t${i}`, `t${j}`));
      }
    }

    // Every topic item links to one neighbour; n0 is linked by all of them.
    topicIds.forEach((id, index) => {
      edges.push(edge(id, "n0"));
      edges.push(edge(id, `n${1 + (index % 19)}`));
    });

    const result = buildTopicGraph(
      new Set(topicIds),
      graphOf([...topicIds, ...neighborIds], edges)
    );
    const inTopic = result.nodes.filter((item) => item.inTopic);

    expect(result.nodes).toHaveLength(MAX_NODES);
    expect(inTopic).toHaveLength(MAX_TOPIC_NODES);
    expect(inTopic.slice(0, 5).map((item) => item.id)).toEqual([
      "t0",
      "t1",
      "t2",
      "t3",
      "t4"
    ]);
    expect(result.nodes.find((item) => !item.inTopic)?.id).toBe("n0");
    expect(result.topicNodeTotal).toBe(30);
    expect(result.neighborTotal).toBe(20);
  });

  it("drops a neighbour that links only to topic items left out by the cap", () => {
    const topicIds = Array.from({ length: 12 }, (_, index) => `t${index}`);
    const edges: ContentGraphEdge[] = [];

    for (let i = 0; i < 10; i += 1) {
      edges.push(edge(`t${i}`, `t${(i + 1) % 10}`));
    }

    edges.push(edge("t11", "lonely"));

    const result = buildTopicGraph(
      new Set(topicIds),
      graphOf([...topicIds, "lonely"], edges)
    );

    expect(result.nodes.map((item) => item.id)).not.toContain("lonely");
    expect(result.neighborTotal).toBe(1);
  });
});

describe("relation families", () => {
  it("puts each of the eight relation types in exactly one family", () => {
    const all = relationFamilyOrder.flatMap(
      (family) => relationFamilyTypes[family]
    );

    expect(new Set(all).size).toBe(8);
    expect(all).toHaveLength(8);
    expect(getRelationFamily("supersedes")).toBe("lineage");
    expect(getRelationFamily("requires")).toBe("dependency");
    expect(getRelationFamily("explains")).toBe("evidence");
    expect(getRelationFamily("related-to")).toBe("plain");
  });
});

describe("layoutTopicGraph", () => {
  it("is deterministic and keeps every node inside the inset", () => {
    const data = buildTopicGraph(
      new Set(["a", "b", "c"]),
      graphOf(
        ["a", "b", "c", "d"],
        [edge("a", "b"), edge("b", "c"), edge("c", "d")]
      )
    );
    const first = layoutTopicGraph(data);

    expect(layoutTopicGraph(data)).toEqual(first);

    for (const point of Object.values(first)) {
      expect(point.x).toBeGreaterThanOrEqual(12);
      expect(point.x).toBeLessThanOrEqual(88);
      expect(point.y).toBeGreaterThanOrEqual(12);
      expect(point.y).toBeLessThanOrEqual(88);
    }
  });
});

describe("separateFootprints", () => {
  it("pushes two overlapping labels apart and keeps them inside the bounds", () => {
    const footprint = estimateFootprint("智能体工作流设计");
    const result = separateFootprints(
      { a: { x: 50, y: 50 }, b: { x: 51, y: 50.5 } },
      { a: footprint, b: footprint },
      12,
      88
    );
    const overlapX =
      Math.min(result.a.x, result.b.x) +
      footprint.right -
      (Math.max(result.a.x, result.b.x) + footprint.left);
    const overlapY =
      Math.min(result.a.y, result.b.y) +
      footprint.bottom -
      (Math.max(result.a.y, result.b.y) + footprint.top);

    expect(overlapX <= 0 || overlapY <= 0).toBe(true);

    for (const point of Object.values(result)) {
      expect(point.x).toBeGreaterThanOrEqual(12);
      expect(point.x).toBeLessThanOrEqual(88);
    }
  });

  it("sizes a two-line label taller than a one-line one", () => {
    const short = estimateFootprint("评估闭环");
    const long = estimateFootprint("长时程智能体的记忆与上下文管理");

    expect(long.bottom).toBeGreaterThan(short.bottom);
    expect(long.right).toBeGreaterThan(short.right);
  });
});
