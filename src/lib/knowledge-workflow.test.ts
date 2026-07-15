import { describe, expect, it } from "vitest";

import {
  applyKnowledgeWorkspaceOverlay,
  buildKnowledgeWorkspaceEntries,
  evaluateKnowledgePublishReadiness
} from "@/lib/knowledge-workflow";
import type { KnowledgeItem, KnowledgeWorkspaceRecord } from "@/types/content";

function makeKnowledge(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: "knowledge-a",
    title: "知识 A",
    slug: "knowledge-a",
    summary: "知识 A 的摘要。",
    content: "知",
    category: "machine-learning",
    difficulty: "foundation",
    tags: ["tag-inference"],
    relatedTechnologyIds: [],
    relatedSkillIds: ["skill-a"],
    ...overrides
  };
}

function makeRecord(
  overrides: Partial<KnowledgeWorkspaceRecord> = {}
): KnowledgeWorkspaceRecord {
  return {
    ...makeKnowledge(),
    status: "draft",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides
  };
}

describe("buildKnowledgeWorkspaceEntries", () => {
  it("marks untouched seeds as seed origin and overridden seeds as override", () => {
    const entries = buildKnowledgeWorkspaceEntries(
      [
        makeKnowledge(),
        makeKnowledge({ id: "knowledge-b", slug: "knowledge-b" })
      ],
      [makeRecord({ title: "改写后的知识 A", status: "published" })]
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].origin).toBe("seed_override");
    expect(entries[0].item.title).toBe("改写后的知识 A");
    expect(entries[1].origin).toBe("seed");
    expect(entries[1].status).toBe("published");
  });
});

describe("evaluateKnowledgePublishReadiness", () => {
  const knownTags = new Set(["tag-inference"]);

  it("blocks on missing required fields and duplicate slug", () => {
    const missing = evaluateKnowledgePublishReadiness(
      makeKnowledge({ title: "", slug: "", summary: "" }),
      [],
      knownTags
    );

    expect(missing.isReady).toBe(false);
    expect(missing.blockingErrors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-title",
        "missing-slug",
        "missing-summary"
      ])
    );

    const duplicate = evaluateKnowledgePublishReadiness(
      makeKnowledge(),
      ["knowledge-a"],
      knownTags
    );

    expect(duplicate.isReady).toBe(false);
    expect(duplicate.blockingErrors[0].code).toBe("duplicate-slug");
  });

  it("warns without blocking on short content and missing relations", () => {
    const readiness = evaluateKnowledgePublishReadiness(
      makeKnowledge({ tags: [], relatedSkillIds: [] }),
      [],
      knownTags
    );

    expect(readiness.isReady).toBe(true);
    expect(readiness.warnings.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "short-content",
        "missing-tags",
        "missing-related-content"
      ])
    );
  });
});

describe("applyKnowledgeWorkspaceOverlay", () => {
  it("applies published overrides, hides draft overrides, appends published new records", () => {
    const merged = applyKnowledgeWorkspaceOverlay(
      [
        makeKnowledge(),
        makeKnowledge({ id: "knowledge-b", slug: "knowledge-b" })
      ],
      [
        makeRecord({ status: "draft" }),
        makeRecord({
          id: "knowledge-ws-1",
          slug: "knowledge-new",
          status: "published"
        }),
        makeRecord({
          id: "knowledge-ws-2",
          slug: "knowledge-new-draft",
          status: "draft"
        })
      ]
    );

    expect(merged.map((item) => item.id)).toEqual([
      "knowledge-b",
      "knowledge-ws-1"
    ]);
    expect(merged[1]).not.toHaveProperty("status");
  });
});
