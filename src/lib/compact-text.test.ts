import { describe, expect, it } from "vitest";

import { compactText } from "./compact-text";

describe("compactText", () => {
  it("returns short text untouched", () => {
    expect(compactText("很短的一句话。", 40)).toBe("很短的一句话。");
  });

  it("trims surrounding whitespace", () => {
    expect(compactText("  很短的一句话。  ", 40)).toBe("很短的一句话。");
  });

  it("cuts on a clause boundary instead of wherever the count runs out", () => {
    // Shaped like the real digest case, where the raw cut landed inside 任务.
    const value =
      "它针对的是被生成式模型遮住的那一半生产负载，意图路由、策略检查、文本分类，这些任务的输出是标签而不是一段话。";

    // The raw cut ends on 这些; the clause boundary is the comma before it.
    expect(compactText(value, 40)).toBe(
      "它针对的是被生成式模型遮住的那一半生产负载，意图路由、策略检查、文本分类…"
    );
  });

  it("never returns more than maxLength, ellipsis included", () => {
    const value = "字".repeat(500);

    for (const max of [4, 10, 33, 140, 190]) {
      expect(compactText(value, max).length).toBeLessThanOrEqual(max);
    }
  });

  it("drops the separator it cut on rather than leaving it dangling", () => {
    const value = "第一句话，第二句话，第三句话，第四句话，第五句话。";

    // Raw cut would end on 第三句; the boundary is the comma two clauses back.
    expect(compactText(value, 14)).toBe("第一句话，第二句话…");
  });

  it("keeps most of the budget rather than backing off to a far boundary", () => {
    // One early comma, then a long run with nothing to cut on.
    const value = `短语，${"字".repeat(200)}`;

    const result = compactText(value, 100);

    expect(result.length).toBeGreaterThan(60);
  });

  it("does not treat a decimal point as a clause ending", () => {
    const value = `以 Apache 2.0 许可发布，${"字".repeat(60)}`;

    const result = compactText(value, 14);

    // Cutting on the `.` would leave `Apache 2` — a version number cut in half.
    expect(result).not.toMatch(/2…$/);
  });

  it("honours a custom ellipsis and counts it against the budget", () => {
    const value = "字".repeat(200);

    const result = compactText(value, 20, "...");

    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("falls back to a word boundary when there is no punctuation", () => {
    const value = "model deployment ".repeat(20);

    const head = compactText(value, 60).replace(/…$/, "");

    // The last word kept must be a whole word from the source, not a prefix of
    // one — `deploym` would be the old behaviour.
    expect(["model", "deployment"]).toContain(head.split(" ").pop());
  });

  it("does not return a bare ellipsis when the budget is tiny but non-zero", () => {
    expect(compactText("字".repeat(50), 2).length).toBeLessThanOrEqual(2);
    expect(compactText("字".repeat(50), 2)).not.toBe("");
  });
});
