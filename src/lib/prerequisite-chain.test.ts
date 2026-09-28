import { describe, expect, it } from "vitest";

import {
  buildPrerequisiteChain,
  type PrerequisiteKind
} from "@/lib/prerequisite-chain";
import type { LinkRelation, RelationType } from "@/types/content";

function kindOf(id: string): PrerequisiteKind {
  return id.startsWith("s-") ? "skill" : "knowledge";
}

function nodes(...ids: string[]): Map<string, PrerequisiteKind> {
  return new Map(ids.map((id) => [id, kindOf(id)]));
}

function requires(
  fromId: string,
  toId: string,
  relationType: RelationType = "requires",
  note?: string
): LinkRelation {
  return {
    id: `relation-${fromId}-${toId}`,
    fromId,
    fromType: kindOf(fromId),
    toId,
    toType: kindOf(toId),
    relationType,
    note
  };
}

const ids = (steps: { id: string }[]) => steps.map((step) => step.id);

describe("buildPrerequisiteChain", () => {
  it("returns nothing when the item requires nothing", () => {
    expect(
      buildPrerequisiteChain("s-a", nodes("s-a", "k-b"), [
        requires("s-a", "k-b", "builds-on")
      ])
    ).toEqual([]);
  });

  it("returns nothing for an item that is not on the published pool", () => {
    expect(
      buildPrerequisiteChain("s-x", nodes("k-b"), [requires("s-x", "k-b")])
    ).toEqual([]);
  });

  it("lists direct prerequisites with the edge's note", () => {
    const chain = buildPrerequisiteChain("s-a", nodes("s-a", "k-b", "k-c"), [
      requires("s-a", "k-b", "requires", "先懂 b"),
      requires("s-a", "k-c")
    ]);

    expect(chain).toEqual([
      {
        id: "k-b",
        kind: "knowledge",
        depth: 1,
        requiredById: "s-a",
        note: "先懂 b"
      },
      { id: "k-c", kind: "knowledge", depth: 1, requiredById: "s-a" }
    ]);
  });

  it("reads `from requires to`, not the reverse", () => {
    // k-b requires s-a: that makes s-a a prerequisite of k-b, not the other
    // way round, so s-a's own chain stays empty.
    const pool = nodes("s-a", "k-b");
    const relations = [requires("k-b", "s-a")];

    expect(buildPrerequisiteChain("s-a", pool, relations)).toEqual([]);
    expect(ids(buildPrerequisiteChain("k-b", pool, relations))).toEqual([
      "s-a"
    ]);
  });

  it("orders a multi-level chain so the deepest prerequisite is read first", () => {
    const chain = buildPrerequisiteChain(
      "s-a",
      nodes("s-a", "k-b", "s-c", "k-d"),
      [requires("s-a", "k-b"), requires("k-b", "s-c"), requires("s-c", "k-d")]
    );

    expect(
      chain.map((step) => [step.id, step.depth, step.requiredById])
    ).toEqual([
      ["k-d", 3, "s-c"],
      ["s-c", 2, "k-b"],
      ["k-b", 1, "s-a"]
    ]);
  });

  it("places a shared prerequisite at its longest distance", () => {
    // a → b → c and a → c directly: c must still come before b.
    const chain = buildPrerequisiteChain("s-a", nodes("s-a", "k-b", "s-c"), [
      requires("s-a", "s-c"),
      requires("s-a", "k-b"),
      requires("k-b", "s-c")
    ]);

    expect(chain.map((step) => [step.id, step.depth])).toEqual([
      ["s-c", 2],
      ["k-b", 1]
    ]);
  });

  it("stops at the depth limit", () => {
    const pool = nodes("s-a", "k-b", "s-c", "k-d", "s-e");
    const relations = [
      requires("s-a", "k-b"),
      requires("k-b", "s-c"),
      requires("s-c", "k-d"),
      requires("k-d", "s-e")
    ];

    expect(ids(buildPrerequisiteChain("s-a", pool, relations))).toEqual([
      "k-d",
      "s-c",
      "k-b"
    ]);
    expect(ids(buildPrerequisiteChain("s-a", pool, relations, 1))).toEqual([
      "k-b"
    ]);
  });

  it("terminates on a cycle and never lists the item itself", () => {
    const pool = nodes("s-a", "k-b", "s-c");
    const relations = [
      requires("s-a", "k-b"),
      requires("k-b", "s-c"),
      requires("s-c", "s-a"),
      requires("s-c", "k-b")
    ];

    const chain = buildPrerequisiteChain("s-a", pool, relations);

    expect(ids(chain)).toEqual(["s-c", "k-b"]);
    expect(ids(chain)).not.toContain("s-a");
  });

  it("drops edges that point at unpublished or unknown content", () => {
    const chain = buildPrerequisiteChain("s-a", nodes("s-a", "k-b", "s-c"), [
      requires("s-a", "k-draft"),
      requires("s-a", "k-b"),
      requires("k-b", "s-c"),
      requires("s-c", "k-draft-2")
    ]);

    expect(ids(chain)).toEqual(["s-c", "k-b"]);
  });

  it("ignores technology endpoints and self-references", () => {
    const chain = buildPrerequisiteChain("s-a", nodes("s-a", "k-b"), [
      {
        id: "relation-tech",
        fromId: "s-a",
        fromType: "skill",
        toId: "tech-1",
        toType: "technology",
        relationType: "requires"
      },
      requires("s-a", "s-a"),
      requires("s-a", "k-b")
    ]);

    expect(ids(chain)).toEqual(["k-b"]);
  });
});
