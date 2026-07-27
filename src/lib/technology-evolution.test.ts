import { describe, expect, it } from "vitest";

import { makeTechnologyItem } from "@/lib/test-factories";
import { buildTechnologyEvolutionChain } from "@/lib/technology-evolution";
import type { LinkRelation, RelationType } from "@/types/content";

function tech(id: string, publishDate: string, slug = id) {
  return makeTechnologyItem({
    id,
    slug,
    publishDate,
    title: { original: id }
  });
}

function relation(
  fromId: string,
  toId: string,
  relationType: RelationType = "supersedes",
  note?: string
): LinkRelation {
  return {
    id: `relation-${fromId}-${toId}`,
    fromId,
    fromType: "technology",
    toId,
    toType: "technology",
    relationType,
    note
  };
}

const versions = [
  tech("v1", "2026-06-30"),
  tech("v2", "2026-07-11"),
  tech("v3", "2026-07-25")
];

describe("buildTechnologyEvolutionChain", () => {
  it("orders the chain by publish date regardless of relation direction", () => {
    // v3->v2 is recorded newest-first, v1->v2 oldest-first: direction must not
    // decide the reading order.
    const chain = buildTechnologyEvolutionChain("v1", versions, [
      relation("v3", "v2"),
      relation("v1", "v2")
    ]);

    expect(chain?.steps.map((step) => step.id)).toEqual(["v1", "v2", "v3"]);
    expect(chain?.currentIndex).toBe(0);
    expect(chain?.laterCount).toBe(2);
  });

  it("reports zero later entries when the current item is the newest", () => {
    const chain = buildTechnologyEvolutionChain("v3", versions, [
      relation("v3", "v2"),
      relation("v2", "v1")
    ]);

    expect(chain?.currentIndex).toBe(2);
    expect(chain?.laterCount).toBe(0);
  });

  it("walks the component transitively, not just direct neighbours", () => {
    const chain = buildTechnologyEvolutionChain("v1", versions, [
      relation("v1", "v2"),
      relation("v2", "v3")
    ]);

    expect(chain?.steps).toHaveLength(3);
  });

  it("ignores relation types other than supersedes", () => {
    // The whole point of the dedicated type: "extends" is already in use for
    // thematic follow-ups and must not read as a version succession.
    const chain = buildTechnologyEvolutionChain("v1", versions, [
      relation("v1", "v2", "extends"),
      relation("v1", "v3", "related-to")
    ]);

    expect(chain).toBeUndefined();
  });

  it("ignores succession edges that are not technology-to-technology", () => {
    const chain = buildTechnologyEvolutionChain("v1", versions, [
      {
        ...relation("v1", "knowledge-1"),
        toType: "knowledge"
      }
    ]);

    expect(chain).toBeUndefined();
  });

  it("returns undefined for an item with no succession edge", () => {
    expect(
      buildTechnologyEvolutionChain("v2", versions, [relation("v1", "v3")])
    ).toBeUndefined();
  });

  it("drops edges pointing at an unpublished or unknown technology", () => {
    const chain = buildTechnologyEvolutionChain("v1", versions, [
      relation("v1", "not-published")
    ]);

    expect(chain).toBeUndefined();
  });

  it("drops a self-reference instead of building a one-item chain", () => {
    expect(
      buildTechnologyEvolutionChain("v1", versions, [relation("v1", "v1")])
    ).toBeUndefined();
  });

  it("attaches the succession note to the newer side of the pair", () => {
    const chain = buildTechnologyEvolutionChain("v3", versions, [
      relation("v2", "v3", "supersedes", "承接 v2 的默认化改动")
    ]);

    expect(chain?.steps.find((step) => step.id === "v3")?.note).toBe(
      "承接 v2 的默认化改动"
    );
    expect(chain?.steps.find((step) => step.id === "v2")?.note).toBeUndefined();
  });

  it("breaks a same-date tie by slug so ordering stays stable", () => {
    const sameDay = [tech("b", "2026-07-01"), tech("a", "2026-07-01")];
    const chain = buildTechnologyEvolutionChain("a", sameDay, [
      relation("b", "a")
    ]);

    expect(chain?.steps.map((step) => step.id)).toEqual(["a", "b"]);
  });
});
