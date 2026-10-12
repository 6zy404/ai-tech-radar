import { describe, expect, it } from "vitest";

import {
  countUntypedRelations,
  evaluateTechnologyPublishReadiness,
  getBroadOnlyTopicTags
} from "@/lib/publish-readiness";
import { makeWorkspaceRecord } from "@/lib/test-factories";
import type { LinkRelation } from "@/types/content";

// Isolate from bundled data by passing empty published/workspace sets and an
// explicit relation list, so each check only sees what a test sets up.
function evaluate(
  record = makeWorkspaceRecord(),
  others: ReturnType<typeof makeWorkspaceRecord>[] = [],
  relations: LinkRelation[] = []
) {
  return evaluateTechnologyPublishReadiness(record, others, [], relations);
}

function relation(
  fromId: string,
  fromType: LinkRelation["fromType"],
  toId: string,
  toType: LinkRelation["toType"],
  relationType: LinkRelation["relationType"] = "supports"
): LinkRelation {
  return {
    id: `rel-${fromId}-${toId}`,
    fromId,
    fromType,
    toId,
    toType,
    relationType
  };
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

describe("evaluateTechnologyPublishReadiness", () => {
  it("treats a complete record as ready with no blocking errors", () => {
    const result = evaluate();

    expect(result.isReady).toBe(true);
    expect(result.blockingErrors).toHaveLength(0);
  });

  it("blocks publication when required fields are missing", () => {
    const record = makeWorkspaceRecord({
      title: { original: "" },
      summary: { original: "" },
      slug: ""
    });

    const result = evaluate(record);

    expect(result.isReady).toBe(false);
    expect(codes(result.blockingErrors)).toEqual(
      expect.arrayContaining([
        "missing-title",
        "missing-summary",
        "missing-slug"
      ])
    );
  });

  it("blocks an invalid source URL and an invalid publish date", () => {
    const record = makeWorkspaceRecord({
      sourceUrl: "not-a-url",
      publishDate: "05/20/2026"
    });

    const result = evaluate(record);

    expect(result.isReady).toBe(false);
    const blockingCodes = codes(result.blockingErrors);
    expect(blockingCodes).toContain("invalid-source-url");
    expect(blockingCodes).toContain("invalid-publish-date");
  });

  it("flags a duplicate slug against another existing record", () => {
    const record = makeWorkspaceRecord({ id: "tech-a", slug: "shared-slug" });
    const other = makeWorkspaceRecord({ id: "tech-b", slug: "shared-slug" });

    const result = evaluate(record, [other]);

    expect(result.isReady).toBe(false);
    expect(codes(result.blockingErrors)).toContain("duplicate-slug");
  });

  // `translationStatus` is editor-set and nothing keeps it honest, so it
  // drifts — 6 of 31 records in July, and 2 of 37 again in August. These pin
  // the comparison against the coverage derived from the actual content.
  describe("translationStatus against derived coverage", () => {
    const translated = {
      title: { original: "Example Technology", zh: "示例技术" },
      summary: { original: "A concise summary.", zh: "一段简短摘要。" },
      content: { original: "Body content.", zh: "正文内容。" }
    };

    it("warns when the content is fully translated but the flag still says pending", () => {
      const record = makeWorkspaceRecord({
        ...translated,
        translationStatus: "pending"
      });

      const result = evaluate(record);

      expect(result.isReady).toBe(true);
      expect(codes(result.warnings)).toContain(
        "translation-status-behind-content"
      );
    });

    it("does not warn once the flag matches the content", () => {
      const record = makeWorkspaceRecord({
        ...translated,
        translationStatus: "done"
      });

      const result = evaluate(record);

      expect(codes(result.warnings)).not.toContain(
        "translation-status-behind-content"
      );
      expect(codes(result.warnings)).not.toContain(
        "translation-status-ahead-of-content"
      );
    });

    it("warns in the other direction when the flag claims done without the content", () => {
      const record = makeWorkspaceRecord({ translationStatus: "done" });

      const result = evaluate(record);

      expect(codes(result.warnings)).toContain(
        "translation-status-ahead-of-content"
      );
    });

    it("stays quiet for a Chinese-source record, where coverage is not_needed", () => {
      const record = makeWorkspaceRecord({
        sourceLanguage: "zh",
        translationStatus: "not_needed"
      });

      const result = evaluate(record);

      expect(codes(result.warnings)).not.toContain(
        "translation-status-behind-content"
      );
      expect(codes(result.warnings)).not.toContain(
        "translation-status-ahead-of-content"
      );
    });

    it("leaves the default fixture untouched, so the check adds no noise", () => {
      const result = evaluate();

      expect(codes(result.warnings)).not.toContain(
        "translation-status-behind-content"
      );
      expect(codes(result.warnings)).not.toContain(
        "translation-status-ahead-of-content"
      );
    });
  });

  describe("Markdown markers in plain-text fields", () => {
    // Title and summary render as plain strings on the hero, the list cards,
    // the digest cards and both feeds; only content goes through ContentBody.
    // Hit twice for real: 2026-08-12 and again 2026-08-14, the second time
    // producing 36 marker occurrences across 9 public surfaces.
    it("warns when a summary carries bold markers", () => {
      const record = makeWorkspaceRecord({
        summary: { original: "plain", zh: "它把**编排**从运行时里拆出来。" }
      });

      expect(codes(evaluate(record).warnings)).toContain(
        "markdown-markers-in-plain-text-field"
      );
    });

    it("warns when a title carries inline code", () => {
      const record = makeWorkspaceRecord({
        title: { original: "plain", zh: "升级到 `v0.32.8` 之后" }
      });

      expect(codes(evaluate(record).warnings)).toContain(
        "markdown-markers-in-plain-text-field"
      );
    });

    it("warns when a summary starts a line with a heading marker", () => {
      const record = makeWorkspaceRecord({
        summary: {
          original: "plain",
          zh: ["第一句。", "## 小节", "第二句。"].join("\n")
        }
      });

      expect(codes(evaluate(record).warnings)).toContain(
        "markdown-markers-in-plain-text-field"
      );
    });

    it("does not warn about markers in content, which does render them", () => {
      const record = makeWorkspaceRecord({
        content: {
          original: "plain",
          zh: ["## 小节", "", "这里的 **加粗** 会被渲染。"].join("\n")
        }
      });

      expect(codes(evaluate(record).warnings)).not.toContain(
        "markdown-markers-in-plain-text-field"
      );
    });

    it("leaves the default fixture untouched, so the check adds no noise", () => {
      expect(codes(evaluate().warnings)).not.toContain(
        "markdown-markers-in-plain-text-field"
      );
    });
  });

  describe("nested inline markers in the body", () => {
    it("warns when inline code is written inside bold", () => {
      const record = makeWorkspaceRecord({
        content: {
          original: "plain",
          zh: "1. **`reasoning_effort`** 分三档，复杂任务拉高。"
        }
      });

      expect(codes(evaluate(record).warnings)).toContain(
        "nested-inline-markers-in-body"
      );
    });

    it("warns in the other direction too", () => {
      const record = makeWorkspaceRecord({
        content: {
          original: "plain",
          zh: "配置项是 `--flag **必填**` 这一个。"
        }
      });

      expect(codes(evaluate(record).warnings)).toContain(
        "nested-inline-markers-in-body"
      );
    });

    it("does not warn when the two sit side by side", () => {
      const record = makeWorkspaceRecord({
        content: {
          original: "plain",
          zh: "1. `reasoning_effort` **分三档**，复杂任务拉高。"
        }
      });

      expect(codes(evaluate(record).warnings)).not.toContain(
        "nested-inline-markers-in-body"
      );
    });

    it("does not warn on a body using both markers separately", () => {
      const record = makeWorkspaceRecord({
        content: {
          original: "plain",
          zh: ["## 小节", "", "跑 `npm test`，**然后**再看结果。"].join("\n")
        }
      });

      expect(codes(evaluate(record).warnings)).not.toContain(
        "nested-inline-markers-in-body"
      );
    });

    it("leaves the default fixture untouched, so the check adds no noise", () => {
      expect(codes(evaluate().warnings)).not.toContain(
        "nested-inline-markers-in-body"
      );
    });
  });

  // 203 of 1124 graph edges were the fallback 关联 on 2026-10-12, 96 of them
  // because no type was ever chosen: the editor does not store a pair left on
  // its default, so nothing on the workspace page said so.
  describe("related items without a relation type", () => {
    const record = makeWorkspaceRecord({
      id: "tech-a",
      relatedTechnologyIds: ["tech-b", "tech-c"],
      relatedSkillIds: ["skill-1"],
      relatedKnowledgeIds: ["knowledge-1"]
    });

    it("counts every pair with no relation entry, per kind", () => {
      expect(countUntypedRelations(record, [])).toEqual({
        technology: 2,
        skill: 1,
        knowledge: 1
      });

      const result = evaluate(record);
      const warning = result.warnings.find(
        (item) => item.code === "untyped-relations"
      );

      expect(warning?.message).toContain("4 条");
      expect(warning?.message).toContain("相关技术 2");
      expect(result.isReady).toBe(true);
    });

    it("accepts a relation stored from either side", () => {
      const relations = [
        relation("tech-a", "technology", "tech-b", "technology"),
        relation("tech-c", "technology", "tech-a", "technology", "extends"),
        relation(
          "knowledge-1",
          "knowledge",
          "tech-a",
          "technology",
          "explains"
        ),
        relation("tech-a", "technology", "skill-1", "skill", "uses")
      ];

      expect(countUntypedRelations(record, relations)).toEqual({});
      expect(codes(evaluate(record, [], relations).warnings)).not.toContain(
        "untyped-relations"
      );
    });

    it("does not count a pair whose stored type is 关联 on purpose", () => {
      const relations = [
        relation("tech-a", "technology", "tech-b", "technology", "related-to")
      ];

      expect(countUntypedRelations(record, relations).technology).toBe(1);
    });

    it("matches the kind as well as the id", () => {
      // A skill relation does not type a technology that happens to share
      // its id.
      const relations = [relation("tech-a", "technology", "tech-b", "skill")];

      expect(countUntypedRelations(record, relations).technology).toBe(2);
    });

    it("ignores a self-reference and duplicate ids", () => {
      const selfish = makeWorkspaceRecord({
        id: "tech-a",
        relatedTechnologyIds: ["tech-a", "tech-b", "tech-b"],
        relatedSkillIds: [],
        relatedKnowledgeIds: []
      });

      expect(countUntypedRelations(selfish, [])).toEqual({ technology: 1 });
    });
  });

  // On 2026-10-12 AI 智能体 sat on 57% of the published signals and 前沿模型
  // on 46%; nine narrower topics were added that day. The gate only checks
  // that a tag id is canonical, so nothing stopped a new signal from going
  // back to the broad ones alone.
  describe("broad topics only", () => {
    it("warns when every topic tag is one of the three broad ones", () => {
      const record = makeWorkspaceRecord({
        tags: ["tag-ai-agents", "tag-frontier-models"]
      });
      const warning = evaluate(record).warnings.find(
        (item) => item.code === "broad-topics-only"
      );

      expect(warning?.message).toContain("AI 智能体、前沿模型");
      expect(warning?.message).toContain("编码智能体");
      expect(warning?.message).toContain("开放权重模型");
    });

    it("names each narrower topic once", () => {
      const record = makeWorkspaceRecord({
        tags: ["tag-frontier-models", "tag-inference"]
      });
      const message =
        evaluate(record).warnings.find(
          (item) => item.code === "broad-topics-only"
        )?.message ?? "";

      expect(message.split("价格与成本")).toHaveLength(2);
    });

    it("stays quiet once a narrower or another specific topic is there", () => {
      expect(
        getBroadOnlyTopicTags(["tag-ai-agents", "tag-coding-agents"])
      ).toEqual([]);
      expect(getBroadOnlyTopicTags(["tag-inference", "tag-retrieval"])).toEqual(
        []
      );
    });

    it("ignores ids that are not topic tags", () => {
      expect(getBroadOnlyTopicTags(["ai", "tooling"])).toEqual([]);
      expect(getBroadOnlyTopicTags(["ai", "tag-inference"])).toEqual([
        "tag-inference"
      ]);
      expect(codes(evaluate().warnings)).not.toContain("broad-topics-only");
    });
  });
});
