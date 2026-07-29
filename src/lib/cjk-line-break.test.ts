import { describe, expect, it } from "vitest";

import { splitIntoUnbreakableRuns } from "@/lib/cjk-line-break";

const joined = (title: string) =>
  splitIntoUnbreakableRuns(title)
    .map((run) => run.text)
    .join("");

const kept = (title: string) =>
  splitIntoUnbreakableRuns(title)
    .filter((run) => run.keepTogether)
    .map((run) => run.text);

describe("splitIntoUnbreakableRuns", () => {
  it("never changes the text, only how it may break", () => {
    const titles = [
      "发现值得关注的 AI 技术",
      "Kimi K3：Moonshot 发布 2.8 万亿参数旗舰，承诺月内开放权重",
      "每日技术简报 - 2026-07-28",
      "Copilot 与裸 API：为编码智能体的「外壳」付费，到底买到了什么"
    ];

    for (const title of titles) {
      expect(joined(title)).toBe(title);
    }
  });

  it("keeps the two words the owner reported together", () => {
    expect(kept("发现值得关注的 AI 技术")).toContain("关注");
    expect(kept("发布 2.8 万亿参数旗舰，承诺月内开放权重")).toContain("旗舰");
  });

  it("keeps a YYYY-MM-DD date whole, since its hyphens are break points", () => {
    expect(kept("每日技术简报 - 2026-07-28")).toContain("2026-07-28");
  });

  it("does not wrap single characters or latin-only runs", () => {
    // Latin words already break on spaces, and a lone character cannot be
    // split — wrapping either would only bloat the markup.
    for (const run of splitIntoUnbreakableRuns("Kimi K3 发布 AI 的 x 技术")) {
      if (!run.keepTogether) continue;
      expect(run.text.length).toBeGreaterThan(1);
      expect(/[一-鿿]/.test(run.text)).toBe(true);
    }
  });

  it("merges neighbouring breakable runs so the markup stays compact", () => {
    const runs = splitIntoUnbreakableRuns("发现值得关注的 AI 技术");

    for (let index = 1; index < runs.length; index += 1) {
      const previous = runs[index - 1];
      const current = runs[index];
      expect(previous.keepTogether || current.keepTogether).toBe(true);
    }
  });

  it("handles an empty title and a title with no CJK", () => {
    expect(splitIntoUnbreakableRuns("")).toEqual([]);
    expect(kept("GPT-Red release notes")).toEqual([]);
    expect(joined("GPT-Red release notes")).toBe("GPT-Red release notes");
  });

  it("records the dictionary's known gaps rather than pretending they pass", () => {
    // Documented limitation: these are real words the ICU dictionary splits.
    // The test asserts today's behaviour so a future segmenter upgrade that
    // fixes them shows up as a failing expectation to revisit, not silently.
    expect(kept("模型权重")).not.toContain("权重");
    expect(kept("智能体工作流")).not.toContain("智能体");
  });
});
