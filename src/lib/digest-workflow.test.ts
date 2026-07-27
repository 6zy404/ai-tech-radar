import { describe, expect, it } from "vitest";

import {
  buildDailyDigestFromTechnologies,
  collectCarriedTechnologyIds,
  getSelectedDigestTechnologyIds
} from "@/lib/digest-workflow";
import { makeTechnologyItem } from "@/lib/test-factories";
import type { DailyDigest } from "@/types/content";

function makeDigest(overrides: Partial<DailyDigest> = {}): DailyDigest {
  const ts = "2026-06-01T12:00:00.000Z";
  return {
    id: "digest-2026-06-01",
    date: "2026-06-01",
    status: "draft",
    title: "Daily Digest",
    summary: "",
    editorialSummary: "",
    highPriorityTechnologyIds: [],
    watchTechnologyIds: [],
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: [],
    skillIds: [],
    knowledgeIds: [],
    sourceNames: [],
    generatedAt: ts,
    updatedAt: ts,
    editorialNotes: [],
    ...overrides
  };
}

describe("getSelectedDigestTechnologyIds (manual editorial controls)", () => {
  it("drops excluded technology ids", () => {
    const ids = getSelectedDigestTechnologyIds(
      makeDigest({
        highPriorityTechnologyIds: ["a", "b"],
        excludedTechnologyIds: ["b"]
      })
    );

    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
  });

  it("includes manually added technology ids", () => {
    const ids = getSelectedDigestTechnologyIds(
      makeDigest({
        highPriorityTechnologyIds: ["a"],
        manuallyAddedTechnologyIds: ["c"]
      })
    );

    expect(ids).toEqual(expect.arrayContaining(["a", "c"]));
  });

  it("places pinned technologies first", () => {
    const ids = getSelectedDigestTechnologyIds(
      makeDigest({
        highPriorityTechnologyIds: ["a", "b", "c"],
        pinnedTechnologyIds: ["c"]
      })
    );

    expect(ids[0]).toBe("c");
  });

  it("respects a manual ordering", () => {
    const ids = getSelectedDigestTechnologyIds(
      makeDigest({
        highPriorityTechnologyIds: ["a", "b", "c"],
        orderedTechnologyIds: ["c", "b", "a"]
      })
    );

    expect(ids).toEqual(["c", "b", "a"]);
  });
});

describe("buildDailyDigestFromTechnologies (generation)", () => {
  const NOW = new Date("2026-06-01T12:00:00.000Z");

  it("puts a strong published technology in high priority and excludes a low-priority one", () => {
    const strong = makeTechnologyItem({
      id: "strong",
      slug: "strong",
      status: "published",
      publishDate: "2026-05-20"
    });
    const weak = makeTechnologyItem({
      id: "weak",
      slug: "weak",
      status: "published",
      publishDate: "2026-05-20",
      summary: { original: "" },
      content: { original: "" },
      tags: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: [],
      publisherName: "",
      importanceLevel: "signal",
      publisherType: "media"
    });

    const digest = buildDailyDigestFromTechnologies(
      [strong, weak],
      "2026-06-01",
      {
        now: NOW
      }
    );

    expect(digest.highPriorityTechnologyIds).toContain("strong");
    expect(digest.highPriorityTechnologyIds).not.toContain("weak");
    expect(digest.watchTechnologyIds).not.toContain("weak");
    expect(digest.orderedTechnologyIds).not.toContain("weak");
    expect(digest.status).toBe("draft");
    expect(digest.date).toBe("2026-06-01");
  });

  it("ignores unpublished (draft) technologies", () => {
    const draft = makeTechnologyItem({
      id: "draftone",
      slug: "draftone",
      status: "draft",
      publishDate: "2026-05-20"
    });

    const digest = buildDailyDigestFromTechnologies([draft], "2026-06-01", {
      now: NOW
    });

    expect(digest.orderedTechnologyIds).not.toContain("draftone");
    expect(digest.highPriorityTechnologyIds).not.toContain("draftone");
    expect(digest.watchTechnologyIds).not.toContain("draftone");
  });

  it("puts never-carried signals ahead of ones a published digest already used", () => {
    const carriedItem = makeTechnologyItem({
      id: "carriedone",
      slug: "carriedone",
      status: "published",
      importanceLevel: "critical",
      publishDate: "2026-05-30"
    });
    const freshItem = makeTechnologyItem({
      id: "freshone",
      slug: "freshone",
      status: "published",
      importanceLevel: "critical",
      publishDate: "2026-05-10"
    });

    const withoutCarry = buildDailyDigestFromTechnologies(
      [carriedItem, freshItem],
      "2026-06-01",
      { now: NOW, maxHighPriorityItems: 1 }
    );
    const withCarry = buildDailyDigestFromTechnologies(
      [carriedItem, freshItem],
      "2026-06-01",
      {
        now: NOW,
        maxHighPriorityItems: 1,
        carriedTechnologyIds: ["carriedone"]
      }
    );

    // Without the carry list the newer item wins on recency ordering.
    expect(withoutCarry.highPriorityTechnologyIds).toEqual(["carriedone"]);
    // With it, the never-carried item takes the single slot instead.
    expect(withCarry.highPriorityTechnologyIds).toEqual(["freshone"]);
  });

  it("falls back to already-carried signals instead of producing an empty digest", () => {
    const onlyItem = makeTechnologyItem({
      id: "onlyone",
      slug: "onlyone",
      status: "published",
      importanceLevel: "critical",
      publishDate: "2026-05-20"
    });

    const digest = buildDailyDigestFromTechnologies([onlyItem], "2026-06-01", {
      now: NOW,
      carriedTechnologyIds: ["onlyone"]
    });

    expect(digest.highPriorityTechnologyIds).toEqual(["onlyone"]);
  });
});

describe("collectCarriedTechnologyIds", () => {
  it("collects ids from published digests only, honouring exclusions and the excluded date", () => {
    const digests: DailyDigest[] = [
      makeDigest({
        date: "2026-05-30",
        status: "published",
        highPriorityTechnologyIds: ["a", "b"],
        excludedTechnologyIds: ["b"]
      }),
      makeDigest({
        date: "2026-05-31",
        status: "published",
        manuallyAddedTechnologyIds: ["c"]
      }),
      makeDigest({
        date: "2026-05-29",
        status: "draft",
        highPriorityTechnologyIds: ["d"]
      }),
      makeDigest({
        date: "2026-06-01",
        status: "published",
        highPriorityTechnologyIds: ["e"]
      })
    ];

    const ids = collectCarriedTechnologyIds(digests, "2026-06-01");

    expect(ids).toContain("a");
    expect(ids).toContain("c");
    // excluded inside its own digest
    expect(ids).not.toContain("b");
    // draft digests are not public, so they do not count as carried
    expect(ids).not.toContain("d");
    // the digest being regenerated must not exclude its own items
    expect(ids).not.toContain("e");
  });
});
