import { describe, expect, it } from "vitest";

import { evaluateTechnologyPublishReadiness } from "@/lib/publish-readiness";
import { makeWorkspaceRecord } from "@/lib/test-factories";

// Isolate from bundled data by passing empty published/workspace sets, so the
// duplicate-slug check only sees what each test sets up explicitly.
function evaluate(
  record = makeWorkspaceRecord(),
  others: ReturnType<typeof makeWorkspaceRecord>[] = []
) {
  return evaluateTechnologyPublishReadiness(record, others, []);
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
});
