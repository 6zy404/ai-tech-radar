import { describe, expect, it } from "vitest";

import { knowledgeItems } from "../src/data/knowledge";
import { topicTags } from "../src/data/tags";
import { parseContentBody } from "../src/lib/content-body";
import { knowledgeAliases } from "../src/lib/knowledge-autolink";
import { evaluateKnowledgePublishReadiness } from "../src/lib/knowledge-workflow";
import {
  newKnowledgeItems,
  planKnowledgeAddition,
  type AdditionInput,
  type NewKnowledgeItem
} from "./add-knowledge-items";

const item: NewKnowledgeItem = {
  id: "knowledge-test",
  title: "测试概念",
  slug: "test-concept",
  summary: "一句摘要。",
  content: "## 标题\n\n正文。",
  category: "machine-learning",
  difficulty: "foundation",
  tags: ["tag-training"],
  signalSlugs: ["sig-a", "sig-b", "sig-draft", "sig-gone"],
  skillIds: ["skill-a", "skill-gone"]
};

function input(overrides: Partial<AdditionInput> = {}): AdditionInput {
  return {
    knowledge: [],
    seedKnowledge: [],
    signals: [
      {
        id: "a",
        slug: "sig-a",
        status: "published",
        relatedKnowledgeIds: ["k-old"],
        updatedAt: "2026-01-01"
      } as AdditionInput["signals"][number],
      { id: "b", slug: "sig-b", status: "published", relatedKnowledgeIds: [] },
      {
        id: "d",
        slug: "sig-draft",
        status: "draft",
        relatedKnowledgeIds: []
      }
    ],
    skillIds: new Set(["skill-a"]),
    relations: [],
    ...overrides
  };
}

let counter = 0;
const nextId = () => `rel-${++counter}`;

describe("planKnowledgeAddition", () => {
  it("adds a published record linked to the published signals and known skills", () => {
    const plan = planKnowledgeAddition(input(), [item], "NOW", nextId);

    expect(plan.addedRecords).toHaveLength(1);
    const record = plan.addedRecords[0];
    expect(record).toMatchObject({
      id: "knowledge-test",
      status: "published",
      createdAt: "NOW",
      updatedAt: "NOW",
      relatedTechnologyIds: ["a", "b"],
      relatedSkillIds: ["skill-a"]
    });
    expect(record).not.toHaveProperty("signalSlugs");
    expect(plan.reports[0]).toMatchObject({
      signalCount: 2,
      skillCount: 1,
      missingSignals: ["sig-draft", "sig-gone"],
      missingSkills: ["skill-gone"]
    });
  });

  it("appends to relatedKnowledgeIds and touches nothing else, in order", () => {
    const before = input();
    const plan = planKnowledgeAddition(before, [item], "NOW", nextId);

    expect(plan.signals.map((signal) => signal.id)).toEqual(["a", "b", "d"]);
    expect(plan.signals[0]).toEqual({
      ...before.signals[0],
      relatedKnowledgeIds: ["k-old", "knowledge-test"]
    });
    expect(plan.signals[2]).toBe(before.signals[2]);
    expect(plan.signalChanges).toBe(2);
    expect(plan.signalLinks).toBe(2);
  });

  it("writes one explains relation per new pair, knowledge first", () => {
    const plan = planKnowledgeAddition(input(), [item], "NOW", nextId);

    expect(plan.newRelations).toHaveLength(3);
    for (const relation of plan.newRelations) {
      expect(relation).toMatchObject({
        fromId: "knowledge-test",
        fromType: "knowledge",
        relationType: "explains"
      });
      expect(relation).not.toHaveProperty("note");
    }
  });

  it("keeps a pair that already has an override, from either side", () => {
    const plan = planKnowledgeAddition(
      input({
        relations: [
          {
            id: "rel-old",
            fromId: "a",
            fromType: "technology",
            toId: "knowledge-test",
            toType: "knowledge",
            relationType: "requires"
          }
        ]
      }),
      [item],
      "NOW",
      nextId
    );

    expect(plan.keptRelations).toBe(1);
    expect(plan.newRelations).toHaveLength(2);
    expect(plan.relations[0].relationType).toBe("requires");
  });

  it("changes nothing on a second run", () => {
    const first = planKnowledgeAddition(input(), [item], "NOW", nextId);
    const second = planKnowledgeAddition(
      input({
        knowledge: first.knowledge,
        signals: first.signals,
        relations: first.relations
      }),
      [item],
      "LATER",
      nextId
    );

    expect(second.addedRecords).toEqual([]);
    expect(second.signalChanges).toBe(0);
    expect(second.newRelations).toEqual([]);
    expect(second.reports[0].added).toBe(false);
  });

  it("refuses a slug another item already uses", () => {
    expect(() =>
      planKnowledgeAddition(
        input({ seedKnowledge: [{ id: "other", slug: "test-concept" }] }),
        [item],
        "NOW",
        nextId
      )
    ).toThrow(/test-concept/);
  });
});

describe("newKnowledgeItems", () => {
  const knownTags = new Set(topicTags.map((tag) => tag.id));
  const seedSlugs = knowledgeItems.map((seed) => seed.slug);

  it("clears the publish gate with no warnings", () => {
    for (const entry of newKnowledgeItems) {
      const others = [
        ...seedSlugs,
        ...newKnowledgeItems
          .filter((other) => other.id !== entry.id)
          .map((other) => other.slug)
      ];
      const readiness = evaluateKnowledgePublishReadiness(
        { ...entry, relatedTechnologyIds: ["x"], relatedSkillIds: ["y"] },
        others,
        knownTags
      );
      expect(readiness.blockingErrors, entry.id).toEqual([]);
      expect(readiness.warnings, entry.id).toEqual([]);
    }
  });

  it("writes bodies in the ContentBody subset, with section headings", () => {
    for (const entry of newKnowledgeItems) {
      const blocks = parseContentBody(entry.content);
      expect(blocks[0]?.kind, entry.id).toBe("heading");
      expect(entry.content, entry.id).not.toMatch(/^#{1}\s|^###/m);
    }
  });

  it("has an alias entry for every item, and no repeated signal", () => {
    for (const entry of newKnowledgeItems) {
      expect(knowledgeAliases[entry.id], entry.id).toBeDefined();
      expect(new Set(entry.signalSlugs).size, entry.id).toBe(
        entry.signalSlugs.length
      );
    }
  });
});
