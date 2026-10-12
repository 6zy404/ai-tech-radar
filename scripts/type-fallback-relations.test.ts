import { describe, expect, it } from "vitest";

import { linkRelations } from "../src/data/relations";
import type { LinkRelation } from "../src/types/content";
import {
  fallbackRelationTypes,
  orphanSignalLinks,
  planFallbackTyping,
  type FallbackTyping,
  type SignalRecord,
  type TypingInput
} from "./type-fallback-relations";

function relation(
  fromId: string,
  fromType: LinkRelation["fromType"],
  toId: string,
  toType: LinkRelation["toType"],
  relationType: LinkRelation["relationType"],
  note?: string
): LinkRelation {
  return {
    id: `rel-${fromId}-${toId}`,
    fromId,
    fromType,
    toId,
    toType,
    relationType,
    ...(note ? { note } : {})
  };
}

const signals: SignalRecord[] = [
  {
    id: "sig-a",
    status: "published",
    relatedTechnologyIds: [],
    updatedAt: "2026-01-01"
  },
  { id: "sig-b", status: "published", relatedTechnologyIds: ["sig-a"] },
  { id: "sig-c", status: "published" },
  { id: "sig-draft", status: "draft", relatedTechnologyIds: [] }
];

function input(overrides: Partial<TypingInput> = {}): TypingInput {
  return {
    relations: [],
    seeds: [],
    knownNodes: new Set([
      "technology:sig-a",
      "technology:sig-b",
      "technology:sig-c",
      "skill:skill-1",
      "knowledge:k-1"
    ]),
    signals,
    publishedSignalIds: new Set(["sig-a", "sig-b", "sig-c"]),
    ...overrides
  };
}

let counter = 0;
const nextId = () => `rel-new-${++counter}`;

function plan(
  typings: FallbackTyping[],
  orphans: Record<string, [string, LinkRelation["relationType"]][]> = {},
  overrides: Partial<TypingInput> = {}
) {
  return planFallbackTyping(input(overrides), typings, orphans, nextId);
}

describe("planFallbackTyping", () => {
  it("retypes a stored 关联 in place, keeping its id, note and direction", () => {
    const stored = relation(
      "sig-b",
      "technology",
      "sig-a",
      "technology",
      "related-to",
      "同一周的两个答案。"
    );
    const result = plan(
      [["technology:sig-a", "technology:sig-b", "supports"]],
      {},
      { relations: [stored] }
    );

    expect(result.relations).toEqual([{ ...stored, relationType: "supports" }]);
    expect(result.retyped).toBe(1);
    expect(result.created).toBe(0);
    // The input store is not mutated.
    expect(stored.relationType).toBe("related-to");
  });

  it("turns a stored 关联 around for requires, the one directed type", () => {
    const stored = relation(
      "k-1",
      "knowledge",
      "sig-a",
      "technology",
      "related-to"
    );
    const result = plan(
      [["technology:sig-a", "knowledge:k-1", "requires"]],
      {},
      { relations: [stored] }
    );

    expect(result.relations[0]).toMatchObject({
      fromId: "sig-a",
      toId: "k-1",
      relationType: "requires"
    });
  });

  it("creates an override with no note for a pair with no entry", () => {
    const result = plan([["knowledge:k-1", "technology:sig-a", "explains"]]);

    expect(result.relations).toEqual([
      {
        id: expect.stringMatching(/^rel-new-/),
        fromId: "k-1",
        fromType: "knowledge",
        toId: "sig-a",
        toType: "technology",
        relationType: "explains"
      }
    ]);
    expect(result.created).toBe(1);
    expect(result.byType).toEqual({ explains: 1 });
  });

  it("copies a seed stored as 关联 with its note instead of editing the seed", () => {
    const seed = relation(
      "sig-a",
      "technology",
      "skill-1",
      "skill",
      "related-to",
      "种子附注"
    );
    const result = plan(
      [["technology:sig-a", "skill:skill-1", "uses"]],
      {},
      { seeds: [seed] }
    );

    expect(result.relations[0]).toMatchObject({
      relationType: "uses",
      note: "种子附注"
    });
    expect(seed.relationType).toBe("related-to");
  });

  it("leaves a pair that already carries another type and reports it", () => {
    const stored = relation(
      "sig-a",
      "technology",
      "skill-1",
      "skill",
      "requires"
    );
    const result = plan(
      [["technology:sig-a", "skill:skill-1", "supports"]],
      {},
      { relations: [stored] }
    );

    expect(result.relations).toEqual([stored]);
    expect(result.retyped + result.created).toBe(0);
    expect(result.skipped.join("\n")).toContain("已是 requires");
  });

  it("skips a pair whose end is not a published node", () => {
    const result = plan([["technology:sig-gone", "skill:skill-1", "uses"]]);

    expect(result.relations).toEqual([]);
    expect(result.skipped.join("\n")).toContain("sig-gone");
  });

  it("appends orphan links in place and types the new pairs", () => {
    const result = plan([], {
      "sig-a": [
        ["sig-b", "supports"],
        ["sig-c", "extends"],
        ["sig-gone", "supports"],
        ["sig-a", "supports"]
      ]
    });
    const updated = result.signals.find((record) => record.id === "sig-a");

    expect(updated).toEqual({
      ...signals[0],
      relatedTechnologyIds: ["sig-b", "sig-c"]
    });
    // Same order, untouched records are the same objects.
    expect(result.signals.map((record) => record.id)).toEqual(
      signals.map((record) => record.id)
    );
    expect(result.signals[1]).toBe(signals[1]);
    expect(result.byType).toEqual({ supports: 1, extends: 1 });
    expect(result.signalChanges).toEqual([
      { id: "sig-a", added: ["sig-b", "sig-c"] }
    ]);
    expect(result.skipped).toHaveLength(2);
  });

  it("keeps an existing typed relation for an orphan link", () => {
    const stored = relation(
      "sig-c",
      "technology",
      "sig-a",
      "technology",
      "extends",
      "同一主张的两翼。"
    );
    const result = plan(
      [],
      { "sig-c": [["sig-a", "extends"]] },
      { relations: [stored] }
    );

    expect(result.relations).toEqual([stored]);
    expect(result.signalChanges).toEqual([{ id: "sig-c", added: ["sig-a"] }]);
  });

  it("does not touch an unpublished orphan or a missing one", () => {
    const result = plan([], {
      "sig-draft": [["sig-a", "supports"]],
      "sig-missing": [["sig-a", "supports"]]
    });

    expect(result.signals).toEqual(signals);
    expect(result.relations).toEqual([]);
    expect(result.skipped).toHaveLength(2);
  });

  it("has nothing to do on a second run", () => {
    const typings: FallbackTyping[] = [
      ["technology:sig-a", "skill:skill-1", "supports"],
      ["technology:sig-b", "knowledge:k-1", "requires"]
    ];
    const orphans = { "sig-a": [["sig-c", "extends"]] } as Record<
      string,
      [string, LinkRelation["relationType"]][]
    >;
    const first = plan(typings, orphans);
    const second = planFallbackTyping(
      input({ relations: first.relations, signals: first.signals }),
      typings,
      orphans,
      nextId
    );

    expect(second.retyped + second.created).toBe(0);
    expect(second.signalChanges).toEqual([]);
    expect(second.relations).toEqual(first.relations);
  });
});

describe("the mapping tables", () => {
  const relationTypes = new Set([
    "builds-on",
    "uses",
    "explains",
    "requires",
    "extends",
    "supports"
  ]);

  it("lists each pair once, with a specific type and well-formed ends", () => {
    const seen = new Set<string>();
    for (const [from, to, type] of fallbackRelationTypes) {
      expect(from).toMatch(/^(technology|skill|knowledge):\S+$/);
      expect(to).toMatch(/^(technology|skill|knowledge):\S+$/);
      expect(relationTypes.has(type)).toBe(true);
      const key = [from, to].sort().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(fallbackRelationTypes).toHaveLength(134);
  });

  it("writes requires from the signal to the knowledge it needs", () => {
    const requires = fallbackRelationTypes.filter(
      ([, , type]) => type === "requires"
    );
    expect(requires.length).toBeGreaterThan(0);
    for (const [from, to] of requires) {
      expect(from.startsWith("technology:")).toBe(true);
      expect(to.startsWith("knowledge:")).toBe(true);
    }
  });

  it("does not retype a seed relation", () => {
    const seedPairs = new Set(
      linkRelations.map((item) =>
        [`${item.fromType}:${item.fromId}`, `${item.toType}:${item.toId}`]
          .sort()
          .join("|")
      )
    );
    for (const [from, to] of fallbackRelationTypes) {
      expect(seedPairs.has([from, to].sort().join("|"))).toBe(false);
    }
  });

  it("gives every orphan signal one to three other signals", () => {
    const entries = Object.entries(orphanSignalLinks);
    expect(entries).toHaveLength(7);
    for (const [id, links] of entries) {
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.length).toBeLessThanOrEqual(3);
      expect(links.some(([target]) => target === id)).toBe(false);
    }
  });
});
