import { describe, expect, it } from "vitest";

import { skillItems } from "../src/data/skills";
import { topicTags } from "../src/data/tags";
import { parseContentBody } from "../src/lib/content-body";
import { evaluateSkillPublishReadiness } from "../src/lib/skill-workflow";
import {
  newSkillItems,
  planSkillAddition,
  type AdditionInput,
  type NewSkillItem
} from "./add-skill-items";

const item: NewSkillItem = {
  id: "skill-test",
  title: "测试技能",
  slug: "test-skill",
  summary: "一句摘要。",
  content: "## 标题\n\n正文。",
  skillType: "engineering",
  heatLevel: "active",
  learningCost: "medium",
  tags: ["tag-coding-agents"],
  signals: [
    { slug: "sig-a", relation: "supports" },
    { slug: "sig-b", relation: "uses" },
    { slug: "sig-draft", relation: "supports" },
    { slug: "sig-gone", relation: "supports" }
  ],
  knowledgeIds: ["k-a", "k-draft", "k-gone"]
};

function input(overrides: Partial<AdditionInput> = {}): AdditionInput {
  return {
    skills: [],
    seedSkills: [],
    signals: [
      {
        id: "a",
        slug: "sig-a",
        status: "published",
        relatedSkillIds: ["s-old"],
        updatedAt: "2026-01-01"
      } as AdditionInput["signals"][number],
      { id: "b", slug: "sig-b", status: "published", relatedSkillIds: [] },
      { id: "d", slug: "sig-draft", status: "draft", relatedSkillIds: [] }
    ],
    knowledge: [
      {
        id: "k-a",
        status: "published",
        relatedSkillIds: [],
        updatedAt: "2026-01-01"
      } as AdditionInput["knowledge"][number],
      { id: "k-draft", status: "draft", relatedSkillIds: [] },
      { id: "k-other", status: "published", relatedSkillIds: [] }
    ],
    relations: [],
    ...overrides
  };
}

let counter = 0;
const nextId = () => `rel-${++counter}`;

describe("planSkillAddition", () => {
  it("adds a published record linked to the published signals and knowledge", () => {
    const plan = planSkillAddition(input(), [item], "NOW", nextId);

    expect(plan.addedRecords).toHaveLength(1);
    const record = plan.addedRecords[0];
    expect(record).toMatchObject({
      id: "skill-test",
      status: "published",
      createdAt: "NOW",
      updatedAt: "NOW",
      relatedTechnologyIds: ["a", "b"],
      relatedKnowledgeIds: ["k-a"]
    });
    expect(record).not.toHaveProperty("signals");
    expect(record).not.toHaveProperty("knowledgeIds");
    expect(plan.reports[0]).toMatchObject({
      signalCount: 2,
      knowledgeCount: 1,
      missingSignals: ["sig-draft", "sig-gone"],
      missingKnowledge: ["k-draft", "k-gone"]
    });
  });

  it("appends to relatedSkillIds on signals and knowledge, touching nothing else", () => {
    const before = input();
    const plan = planSkillAddition(before, [item], "NOW", nextId);

    expect(plan.signals.map((signal) => signal.id)).toEqual(["a", "b", "d"]);
    expect(plan.signals[0]).toEqual({
      ...before.signals[0],
      relatedSkillIds: ["s-old", "skill-test"]
    });
    expect(plan.signals[2]).toBe(before.signals[2]);
    expect(plan.signalChanges).toBe(2);
    expect(plan.signalLinks).toBe(2);

    expect(plan.knowledge[0]).toEqual({
      ...before.knowledge[0],
      relatedSkillIds: ["skill-test"]
    });
    expect(plan.knowledge[1]).toBe(before.knowledge[1]);
    expect(plan.knowledge[2]).toBe(before.knowledge[2]);
    expect(plan.knowledgeChanges).toBe(1);
  });

  it("types every new pair: the planned relation to signals, requires to knowledge", () => {
    const plan = planSkillAddition(input(), [item], "NOW", nextId);

    expect(
      plan.newRelations.map((relation) => [
        relation.toId,
        relation.toType,
        relation.relationType
      ])
    ).toEqual([
      ["a", "technology", "supports"],
      ["b", "technology", "uses"],
      ["k-a", "knowledge", "requires"]
    ]);
    for (const relation of plan.newRelations) {
      expect(relation).toMatchObject({
        fromId: "skill-test",
        fromType: "skill"
      });
      expect(relation.relationType).not.toBe("related-to");
      expect(relation).not.toHaveProperty("note");
    }
  });

  it("keeps a pair that already has an override, from either side", () => {
    const plan = planSkillAddition(
      input({
        relations: [
          {
            id: "rel-old",
            fromId: "a",
            fromType: "technology",
            toId: "skill-test",
            toType: "skill",
            relationType: "extends"
          }
        ]
      }),
      [item],
      "NOW",
      nextId
    );

    expect(plan.keptRelations).toBe(1);
    expect(plan.newRelations).toHaveLength(2);
    expect(plan.relations[0].relationType).toBe("extends");
  });

  it("appends a shared signal once per skill", () => {
    const second: NewSkillItem = { ...item, id: "skill-two", slug: "two" };
    const plan = planSkillAddition(input(), [item, second], "NOW", nextId);

    expect(plan.signals[1].relatedSkillIds).toEqual([
      "skill-test",
      "skill-two"
    ]);
    expect(plan.signalLinks).toBe(4);
  });

  it("changes nothing on a second run", () => {
    const first = planSkillAddition(input(), [item], "NOW", nextId);
    const second = planSkillAddition(
      input({
        skills: first.skills,
        signals: first.signals,
        knowledge: first.knowledge,
        relations: first.relations
      }),
      [item],
      "LATER",
      nextId
    );

    expect(second.addedRecords).toEqual([]);
    expect(second.signalChanges).toBe(0);
    expect(second.knowledgeChanges).toBe(0);
    expect(second.newRelations).toEqual([]);
    expect(second.reports[0].added).toBe(false);
  });

  it("refuses a slug another item already uses", () => {
    expect(() =>
      planSkillAddition(
        input({ seedSkills: [{ id: "other", slug: "test-skill" }] }),
        [item],
        "NOW",
        nextId
      )
    ).toThrow(/test-skill/);
  });
});

describe("newSkillItems", () => {
  const knownTags = new Set(topicTags.map((tag) => tag.id));
  const seedSlugs = skillItems.map((seed) => seed.slug);

  it("clears the publish gate with no warnings", () => {
    for (const entry of newSkillItems) {
      const others = [
        ...seedSlugs,
        ...newSkillItems
          .filter((other) => other.id !== entry.id)
          .map((other) => other.slug)
      ];
      const readiness = evaluateSkillPublishReadiness(
        { ...entry, relatedTechnologyIds: ["x"], relatedKnowledgeIds: ["y"] },
        others,
        knownTags
      );
      expect(readiness.blockingErrors, entry.id).toEqual([]);
      expect(readiness.warnings, entry.id).toEqual([]);
    }
  });

  it("covers each of the four topics that had no skill", () => {
    const tags = new Set(newSkillItems.flatMap((entry) => entry.tags));
    for (const tag of [
      "tag-coding-agents",
      "tag-ai-for-science",
      "tag-open-weights",
      "tag-efficient-inference"
    ]) {
      expect(tags.has(tag), tag).toBe(true);
    }
  });

  it("writes bodies in the ContentBody subset, with section headings", () => {
    for (const entry of newSkillItems) {
      const blocks = parseContentBody(entry.content);
      expect(blocks[0]?.kind, entry.id).toBe("heading");
      expect(entry.content, entry.id).not.toMatch(/^#{1}\s|^###/m);
      expect(entry.content, entry.id).not.toMatch(/\]\(|<[a-z]/);
    }
  });

  it("repeats no signal or knowledge item within one skill", () => {
    for (const entry of newSkillItems) {
      const slugs = entry.signals.map((signal) => signal.slug);
      expect(new Set(slugs).size, entry.id).toBe(slugs.length);
      expect(new Set(entry.knowledgeIds).size, entry.id).toBe(
        entry.knowledgeIds.length
      );
      expect(entry.signals.length, entry.id).toBeGreaterThanOrEqual(5);
    }
  });
});
