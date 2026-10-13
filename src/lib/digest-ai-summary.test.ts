import { describe, expect, it } from "vitest";

import {
  buildOverviewUserPrompt,
  cleanOverviewText,
  DIGEST_SUMMARY_PROMPT_VERSION,
  draftOverview,
  OVERVIEW_HARD_LIMIT,
  OVERVIEW_LIMITS,
  validateOverviewOutput,
  WEEKLY_SUMMARY_PROMPT_VERSION,
  type OverviewInput
} from "@/lib/digest-ai-summary";
import type { LlmProvider } from "@/lib/llm/provider";
import { createMockLlmProvider } from "@/lib/llm/providers/mock";

const input: OverviewInput = {
  label: "2026-10-13 这一期",
  signals: [
    {
      section: "立即关注",
      title: "VISTA 把 ARC-AGI-3 公开集打到满分",
      summary: "何恺明团队的 VISTA 存下每一帧画面，推理时按需回看。",
      whyItMatters: "上限越来越取决于模型外面那一层。",
      publisherName: "MIT",
      publishDate: "2026-10-12"
    },
    {
      section: "值得跟踪",
      title: "CodeScene 用智能体重构 30 万行 C 代码",
      summary: "靠确定性质量评分和回放测试验收。",
      publishDate: "2026-10-11"
    }
  ]
};

const longText = "这一期的信号都在说同一件事。".repeat(40);

function providerReturning(text: string): LlmProvider {
  return {
    name: "fixed",
    modelName: "fixed-model",
    isAvailable: () => ({ available: true }),
    async generate() {
      return { text, providerName: "fixed", modelName: "fixed-model" };
    }
  };
}

describe("buildOverviewUserPrompt", () => {
  it("opens with the purpose line and lists each signal with its section", () => {
    const prompt = buildOverviewUserPrompt("digest", input);

    expect(prompt.split("\n")[0]).toBe("Purpose: digest_editorial_summary");
    expect(prompt).toContain("### 1. [立即关注] VISTA 把 ARC-AGI-3 公开集打到满分");
    expect(prompt).toContain("发布方: MIT · 发布日期: 2026-10-12");
    expect(prompt).toContain("为什么重要: 上限越来越取决于模型外面那一层。");
    expect(prompt).toContain("### 2. [值得跟踪] CodeScene");
    expect(buildOverviewUserPrompt("weekly", input).split("\n")[0]).toBe(
      "Purpose: weekly_summary"
    );
  });
});

describe("cleanOverviewText", () => {
  it("keeps paragraphs and bold, flattens the rest of Markdown", () => {
    expect(
      cleanOverviewText(
        '## 标题\n\n- 第一条 [链接](https://x.dev) 用了 `code`\n\n\n\n**要点**是 "上下文"。\n| a | b |'
      )
    ).toBe("标题\n\n第一条 链接 用了 code\n\n**要点**是 「上下文」。");
  });
});

describe("validateOverviewOutput", () => {
  it("accepts a clean overview", () => {
    const text = "甲".repeat(OVERVIEW_LIMITS.digest.min + 10);
    const result = validateOverviewOutput(
      JSON.stringify({ editorialSummary: text }),
      "digest"
    );

    expect(result).toEqual({ ok: true, text, warnings: [] });
  });

  it("keeps a long overview whole and asks the editor to shorten it", () => {
    const result = validateOverviewOutput(
      JSON.stringify({ editorialSummary: longText }),
      "digest"
    );

    expect(result.ok && result.text).toBe(longText);
    expect(result.ok && result.warnings[0]).toContain("保存前请删短");
  });

  it("cuts only past the hard limit, at a sentence end", () => {
    const result = validateOverviewOutput(
      JSON.stringify({ editorialSummary: longText.repeat(3) }),
      "weekly"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.length).toBeLessThanOrEqual(OVERVIEW_HARD_LIMIT);
      expect(result.text.endsWith("。")).toBe(true);
      expect(result.warnings[0]).toContain("已在句末截断");
    }
  });

  it("warns on a short overview, on words the public page hides, and passes on limitations", () => {
    const result = validateOverviewOutput(
      JSON.stringify({
        editorialSummary: "这是 test 用的短导语。",
        limitations: ["第二条缺少数字"]
      }),
      "weekly"
    );

    expect(result.ok && result.warnings).toEqual([
      expect.stringContaining("偏短"),
      expect.stringContaining("公开页会整段隐藏"),
      "模型注明：第二条缺少数字"
    ]);
  });

  it("rejects output with no overview or that is not JSON", () => {
    expect(
      validateOverviewOutput(JSON.stringify({ limitations: [] }), "digest").ok
    ).toBe(false);
    expect(validateOverviewOutput("不是 JSON", "digest").ok).toBe(false);
  });
});

describe("draftOverview", () => {
  it("runs end to end on the mock provider and tags the prompt version", async () => {
    const result = await draftOverview(
      "digest",
      input,
      createMockLlmProvider()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("「VISTA 把 ARC-AGI-3 公开集打到满分」");
      expect(result.metadata.promptVersion).toBe(DIGEST_SUMMARY_PROMPT_VERSION);
      expect(result.metadata.modelName).toBe("mock-overview-v0");
      // The mock says "mock", so the editor is told the public page would
      // hide it — mock output can never reach readers unnoticed.
      expect(result.warnings).toContainEqual(
        expect.stringContaining("公开页会整段隐藏")
      );
    }
  });

  it("uses the weekly prompt version for a week", async () => {
    const result = await draftOverview(
      "weekly",
      input,
      createMockLlmProvider()
    );

    expect(result.ok && result.metadata.promptVersion).toBe(
      WEEKLY_SUMMARY_PROMPT_VERSION
    );
  });

  it("refuses to call the model without signals", async () => {
    let called = false;
    const provider = {
      ...providerReturning("{}"),
      async generate() {
        called = true;
        throw new Error("should not be called");
      }
    };
    const result = await draftOverview(
      "digest",
      { label: "空", signals: [] },
      provider
    );

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(called).toBe(false);
  });

  it("reports a provider error as 502 and invalid output as 422", async () => {
    const failing: LlmProvider = {
      ...providerReturning(""),
      async generate() {
        throw new Error("timeout");
      }
    };

    expect(await draftOverview("digest", input, failing)).toMatchObject({
      ok: false,
      status: 502
    });
    expect(
      await draftOverview("digest", input, providerReturning("胡言乱语"))
    ).toMatchObject({ ok: false, status: 422 });
  });
});
