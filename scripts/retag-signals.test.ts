import { describe, expect, it } from "vitest";

import { topicTags } from "../src/data/tags";
import {
  applyRetag,
  countTags,
  findUnknownTags,
  knowledgeRetags,
  narrowedTopicIds,
  newTopicIds,
  planRetag,
  signalRetags,
  skillRetags
} from "./retag-signals";

const tagIds = topicTags.map((tag) => tag.id);

// Readers' follows, 关注码 and the per-topic feed addresses refer to these.
const originalTopicIds = [
  "tag-ai-agents",
  "tag-retrieval",
  "tag-multimodal",
  "tag-workflow",
  "tag-on-device",
  "tag-observability",
  "tag-knowledge-graph",
  "tag-product-strategy",
  "tag-inference",
  "tag-frontier-models"
];

describe("tags.ts", () => {
  it("keeps every original topic id and defines the new ones once", () => {
    expect(tagIds).toEqual(expect.arrayContaining(originalTopicIds));
    expect(tagIds).toEqual(expect.arrayContaining([...newTopicIds]));
    expect(new Set(tagIds).size).toBe(tagIds.length);
  });
});

describe("retag tables", () => {
  const tables = [signalRetags, skillRetags, knowledgeRetags];

  it("only mention topics tags.ts defines", () => {
    expect(findUnknownTags(tables, tagIds)).toEqual([]);
  });

  it("never add and remove the same tag, and no entry is empty", () => {
    for (const table of tables) {
      for (const [id, plan] of Object.entries(table)) {
        expect(plan.add.length + plan.remove.length, id).toBeGreaterThan(0);
        expect(
          plan.add.filter((tag) => plan.remove.includes(tag)),
          id
        ).toEqual([]);
      }
    }
  });

  it("take off signals only the three narrowed broad topics", () => {
    const removed = new Set(
      Object.values(signalRetags).flatMap((plan) => plan.remove)
    );
    for (const tag of removed) {
      expect(narrowedTopicIds as readonly string[]).toContain(tag);
    }
  });

  it("only add tags to skills and knowledge", () => {
    for (const table of [skillRetags, knowledgeRetags]) {
      for (const plan of Object.values(table)) {
        expect(plan.remove).toEqual([]);
      }
    }
  });

  it("give every new topic between 5 and 30 signals", () => {
    const added = countTags(
      Object.values(signalRetags).map((plan) => plan.add)
    );
    for (const tag of newTopicIds) {
      const count = added.get(tag) ?? 0;
      expect(count, tag).toBeGreaterThanOrEqual(5);
      expect(count, tag).toBeLessThanOrEqual(30);
    }
  });
});

describe("applyRetag", () => {
  it("keeps the existing order, drops removals and appends additions", () => {
    expect(
      applyRetag(["tag-ai-agents", "tag-workflow", "tag-inference"], {
        add: ["tag-agent-infra"],
        remove: ["tag-inference"]
      })
    ).toEqual(["tag-ai-agents", "tag-workflow", "tag-agent-infra"]);
  });

  it("is idempotent", () => {
    const plan = { add: ["tag-coding-agents"], remove: ["tag-ai-agents"] };
    const once = applyRetag(["tag-ai-agents", "tag-workflow"], plan);
    expect(applyRetag(once, plan)).toEqual(once);
  });
});

describe("planRetag", () => {
  const records = [
    { id: "a", tags: ["tag-ai-agents", "tag-workflow"], updatedAt: "1" },
    { id: "b", tags: ["tag-inference"], updatedAt: "2" },
    { id: "c", tags: ["tag-multimodal"], updatedAt: "3" }
  ];
  const plans = {
    a: { add: ["tag-coding-agents"], remove: ["tag-ai-agents"] },
    b: { add: [], remove: ["tag-frontier-models"] },
    gone: { add: ["tag-training"], remove: [] }
  };

  it("changes only tags, keeps record order and reports missing ids", () => {
    const { next, changes, missing } = planRetag(records, plans);

    expect(next.map((record) => record.id)).toEqual(["a", "b", "c"]);
    expect(next[0]).toEqual({
      id: "a",
      tags: ["tag-workflow", "tag-coding-agents"],
      updatedAt: "1"
    });
    // A plan that changes nothing is not a change.
    expect(next[1]).toBe(records[1]);
    expect(next[2]).toBe(records[2]);
    expect(changes).toEqual([
      {
        id: "a",
        before: ["tag-ai-agents", "tag-workflow"],
        after: ["tag-workflow", "tag-coding-agents"]
      }
    ]);
    expect(missing).toEqual(["gone"]);
  });

  it("finds nothing to do on a second run", () => {
    const { next } = planRetag(records, plans);
    expect(planRetag(next, plans).changes).toEqual([]);
  });
});
