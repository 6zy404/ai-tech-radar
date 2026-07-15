import { describe, expect, it } from "vitest";

import {
  applySkillWorkspaceOverlay,
  buildSkillWorkspaceEntries,
  evaluateSkillPublishReadiness
} from "@/lib/skill-workflow";
import type { SkillItem, SkillWorkspaceRecord } from "@/types/content";

function makeSkill(overrides: Partial<SkillItem> = {}): SkillItem {
  return {
    id: "skill-a",
    title: "技能 A",
    slug: "skill-a",
    summary: "技能 A 的摘要。",
    content: "技",
    skillType: "engineering",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-inference"],
    relatedTechnologyIds: [],
    relatedKnowledgeIds: ["knowledge-a"],
    ...overrides
  };
}

function makeRecord(
  overrides: Partial<SkillWorkspaceRecord> = {}
): SkillWorkspaceRecord {
  return {
    ...makeSkill(),
    status: "draft",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides
  };
}

describe("buildSkillWorkspaceEntries", () => {
  it("marks untouched seeds as seed origin with published status", () => {
    const entries = buildSkillWorkspaceEntries([makeSkill()], []);

    expect(entries).toHaveLength(1);
    expect(entries[0].origin).toBe("seed");
    expect(entries[0].status).toBe("published");
    expect(entries[0].updatedAt).toBeUndefined();
  });

  it("replaces an overridden seed with its workspace copy", () => {
    const entries = buildSkillWorkspaceEntries(
      [makeSkill()],
      [makeRecord({ title: "改写后的技能 A", status: "published" })]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].origin).toBe("seed_override");
    expect(entries[0].item.title).toBe("改写后的技能 A");
  });

  it("lists workspace-new records before seeds", () => {
    const entries = buildSkillWorkspaceEntries(
      [makeSkill()],
      [makeRecord({ id: "skill-ws-1", slug: "skill-new" })]
    );

    expect(entries.map((entry) => entry.origin)).toEqual(["workspace", "seed"]);
    expect(entries[0].status).toBe("draft");
  });
});

describe("evaluateSkillPublishReadiness", () => {
  const knownTags = new Set(["tag-inference"]);

  it("passes a complete record with warnings only", () => {
    const readiness = evaluateSkillPublishReadiness(
      makeSkill(),
      ["other-slug"],
      knownTags
    );

    expect(readiness.isReady).toBe(true);
    expect(readiness.blockingErrors).toHaveLength(0);
    expect(readiness.warnings.map((issue) => issue.code)).toContain(
      "short-content"
    );
  });

  it("blocks on missing title, slug, and summary", () => {
    const readiness = evaluateSkillPublishReadiness(
      makeSkill({ title: "", slug: "", summary: "" }),
      [],
      knownTags
    );

    expect(readiness.isReady).toBe(false);
    expect(readiness.blockingErrors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-title",
        "missing-slug",
        "missing-summary"
      ])
    );
  });

  it("blocks on a duplicate slug", () => {
    const readiness = evaluateSkillPublishReadiness(
      makeSkill(),
      ["skill-a"],
      knownTags
    );

    expect(readiness.isReady).toBe(false);
    expect(readiness.blockingErrors[0].code).toBe("duplicate-slug");
  });

  it("warns on non-canonical tags and missing related content", () => {
    const readiness = evaluateSkillPublishReadiness(
      makeSkill({ tags: ["freeform tag"], relatedKnowledgeIds: [] }),
      [],
      knownTags
    );

    expect(readiness.isReady).toBe(true);
    expect(readiness.warnings.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["non-canonical-tags", "missing-related-content"])
    );
  });
});

describe("applySkillWorkspaceOverlay", () => {
  it("keeps untouched seeds as-is", () => {
    const merged = applySkillWorkspaceOverlay([makeSkill()], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("skill-a");
  });

  it("replaces a seed with its published workspace copy", () => {
    const merged = applySkillWorkspaceOverlay(
      [makeSkill()],
      [makeRecord({ title: "改写后的技能 A", status: "published" })]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("改写后的技能 A");
  });

  it("hides a seed whose workspace copy is draft", () => {
    const merged = applySkillWorkspaceOverlay(
      [makeSkill()],
      [makeRecord({ status: "draft" })]
    );

    expect(merged).toHaveLength(0);
  });

  it("includes workspace-new records only once published", () => {
    const records = [
      makeRecord({ id: "skill-ws-1", slug: "skill-new-1", status: "draft" }),
      makeRecord({ id: "skill-ws-2", slug: "skill-new-2", status: "published" })
    ];
    const merged = applySkillWorkspaceOverlay([makeSkill()], records);

    expect(merged.map((item) => item.id)).toEqual(["skill-a", "skill-ws-2"]);
  });

  it("returns items without workspace-only fields", () => {
    const merged = applySkillWorkspaceOverlay(
      [],
      [makeRecord({ id: "skill-ws-1", status: "published" })]
    );

    expect(merged[0]).not.toHaveProperty("status");
    expect(merged[0]).not.toHaveProperty("createdAt");
    expect(merged[0]).not.toHaveProperty("updatedAt");
  });
});
