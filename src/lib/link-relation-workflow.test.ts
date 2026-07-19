import { describe, expect, it } from "vitest";

import {
  applyLinkRelationOverlay,
  findRelationIn,
  getRelationPairKey,
  planLinkRelationSync
} from "@/lib/link-relation-workflow";
import type { LinkRelation } from "@/types/content";

const seedRelation: LinkRelation = {
  id: "rel-seed-1",
  fromId: "tech-a",
  fromType: "technology",
  toId: "knowledge-b",
  toType: "knowledge",
  relationType: "builds-on",
  note: "seed note"
};

const otherSeed: LinkRelation = {
  id: "rel-seed-2",
  fromId: "skill-c",
  fromType: "skill",
  toId: "knowledge-b",
  toType: "knowledge",
  relationType: "requires"
};

describe("getRelationPairKey", () => {
  it("returns the same key regardless of side order", () => {
    expect(
      getRelationPairKey("tech-a", "technology", "knowledge-b", "knowledge")
    ).toBe(
      getRelationPairKey("knowledge-b", "knowledge", "tech-a", "technology")
    );
  });

  it("distinguishes the same ids under different kinds", () => {
    expect(getRelationPairKey("x", "skill", "y", "knowledge")).not.toBe(
      getRelationPairKey("x", "technology", "y", "knowledge")
    );
  });
});

describe("applyLinkRelationOverlay", () => {
  it("passes seeds through when no override exists", () => {
    expect(applyLinkRelationOverlay([seedRelation, otherSeed], [])).toEqual([
      seedRelation,
      otherSeed
    ]);
  });

  it("replaces a seed with an override for the same pair, even reversed", () => {
    const override: LinkRelation = {
      id: "rel-ws-1",
      fromId: "knowledge-b",
      fromType: "knowledge",
      toId: "tech-a",
      toType: "technology",
      relationType: "requires",
      note: "edited"
    };

    const merged = applyLinkRelationOverlay(
      [seedRelation, otherSeed],
      [override]
    );

    expect(merged).toHaveLength(2);
    expect(merged).toContainEqual(override);
    expect(merged).toContainEqual(otherSeed);
    expect(merged).not.toContainEqual(seedRelation);
  });
});

describe("findRelationIn", () => {
  it("finds a relation regardless of lookup direction", () => {
    const result = findRelationIn(
      [seedRelation],
      "knowledge-b",
      "knowledge",
      "tech-a",
      "technology"
    );

    expect(result).toEqual({ relationType: "builds-on", note: "seed note" });
  });

  it("falls back to the default for an unknown pair", () => {
    expect(
      findRelationIn([seedRelation], "x", "skill", "y", "knowledge")
    ).toEqual({ relationType: "related-to", note: undefined });
  });
});

describe("planLinkRelationSync", () => {
  const from = { id: "tech-a", type: "technology" as const };

  it("writes an override when the value differs from the seed", () => {
    const { nextOverrides, changedPairKeys } = planLinkRelationSync(
      [seedRelation],
      [],
      from,
      [
        {
          toId: "knowledge-b",
          toType: "knowledge",
          relationType: "requires",
          note: "new note"
        }
      ]
    );

    expect(changedPairKeys).toHaveLength(1);
    expect(nextOverrides).toHaveLength(1);
    expect(nextOverrides[0]).toMatchObject({
      fromId: "tech-a",
      toId: "knowledge-b",
      relationType: "requires",
      note: "new note"
    });
  });

  it("removes the override when the value reverts to the seed", () => {
    const override: LinkRelation = {
      id: "rel-ws-1",
      fromId: "tech-a",
      fromType: "technology",
      toId: "knowledge-b",
      toType: "knowledge",
      relationType: "requires"
    };

    const { nextOverrides, changedPairKeys } = planLinkRelationSync(
      [seedRelation],
      [override],
      from,
      [
        {
          toId: "knowledge-b",
          toType: "knowledge",
          relationType: "builds-on",
          note: "seed note"
        }
      ]
    );

    expect(changedPairKeys).toHaveLength(1);
    expect(nextOverrides).toHaveLength(0);
  });

  it("does not persist the generic default for a pair with no seed", () => {
    const { nextOverrides, changedPairKeys } = planLinkRelationSync(
      [],
      [],
      from,
      [{ toId: "skill-x", toType: "skill", relationType: "related-to" }]
    );

    expect(changedPairKeys).toHaveLength(0);
    expect(nextOverrides).toHaveLength(0);
  });

  it("persists the generic type when a note is attached", () => {
    const { nextOverrides } = planLinkRelationSync([], [], from, [
      {
        toId: "skill-x",
        toType: "skill",
        relationType: "related-to",
        note: "still worth a note"
      }
    ]);

    expect(nextOverrides).toHaveLength(1);
    expect(nextOverrides[0]).toMatchObject({
      relationType: "related-to",
      note: "still worth a note"
    });
  });

  it("reports no change when the override already matches", () => {
    const override: LinkRelation = {
      id: "rel-ws-1",
      fromId: "tech-a",
      fromType: "technology",
      toId: "knowledge-b",
      toType: "knowledge",
      relationType: "requires",
      note: "same"
    };

    const { nextOverrides, changedPairKeys } = planLinkRelationSync(
      [seedRelation],
      [override],
      from,
      [
        {
          toId: "knowledge-b",
          toType: "knowledge",
          relationType: "requires",
          note: "same"
        }
      ]
    );

    expect(changedPairKeys).toHaveLength(0);
    expect(nextOverrides).toEqual([override]);
  });

  it("leaves pairs not mentioned in targets untouched", () => {
    const unrelatedOverride: LinkRelation = {
      id: "rel-ws-9",
      fromId: "skill-c",
      fromType: "skill",
      toId: "knowledge-b",
      toType: "knowledge",
      relationType: "extends"
    };

    const { nextOverrides } = planLinkRelationSync(
      [seedRelation],
      [unrelatedOverride],
      from,
      [
        {
          toId: "knowledge-b",
          toType: "knowledge",
          relationType: "uses"
        }
      ]
    );

    expect(nextOverrides).toContainEqual(unrelatedOverride);
    expect(nextOverrides).toHaveLength(2);
  });

  it("ignores targets with invalid kinds or relation types", () => {
    const { nextOverrides, changedPairKeys } = planLinkRelationSync(
      [],
      [],
      from,
      [
        {
          toId: "skill-x",
          toType: "bogus" as never,
          relationType: "requires"
        },
        {
          toId: "skill-y",
          toType: "skill",
          relationType: "bogus" as never
        }
      ]
    );

    expect(changedPairKeys).toHaveLength(0);
    expect(nextOverrides).toHaveLength(0);
  });
});
