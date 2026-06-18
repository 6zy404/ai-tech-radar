import { describe, expect, it } from "vitest";

import {
  buildDailyDigestFromTechnologies,
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

    const digest = buildDailyDigestFromTechnologies([strong, weak], "2026-06-01", {
      now: NOW
    });

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
});
