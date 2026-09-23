import { describe, expect, it } from "vitest";
import {
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
  parseTriageOutput,
  runCandidateTriage,
  type TriageExample,
  type TriageInput
} from "@/lib/candidate-llm-triage";
import type { LlmProvider } from "@/lib/llm/provider";

const input: TriageInput = {
  title: "v0.34.3",
  summary: "",
  content: "",
  sourceName: "Ollama Releases",
  sourceUrl: "https://github.com/ollama/ollama/releases/tag/v0.34.3-rc0",
  publisherName: "Ollama",
  publishDate: "2026-09-18"
};

function providerReturning(text: string): LlmProvider {
  return {
    name: "test",
    modelName: "test-model",
    isAvailable: () => ({ available: true }),
    generate: async () => ({
      text,
      providerName: "test",
      modelName: "test-model",
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    })
  };
}

describe("parseTriageOutput", () => {
  it("accepts a well-formed answer and normalises the decision's case", () => {
    const result = parseTriageOutput(
      '{"decision":"Reject","confidence":0.9,"reason":"预发布版本"}'
    );

    expect(result).toEqual({
      suggestion: { decision: "reject", confidence: 0.9, reason: "预发布版本" }
    });
  });

  it("finds the object inside surrounding prose", () => {
    const result = parseTriageOutput(
      '好的：\n{"decision":"review","confidence":0.4,"reason":"只有标题"}\n以上。'
    );

    expect("suggestion" in result && result.suggestion.decision).toBe("review");
  });

  it("rejects an unknown decision instead of guessing", () => {
    expect(parseTriageOutput('{"decision":"maybe"}')).toEqual({
      error: "未知的处置：maybe"
    });
  });

  it("clamps confidence and defaults it when missing", () => {
    const high = parseTriageOutput('{"decision":"publish","confidence":7}');
    const missing = parseTriageOutput('{"decision":"publish"}');

    expect("suggestion" in high && high.suggestion.confidence).toBe(1);
    expect("suggestion" in missing && missing.suggestion.confidence).toBe(0.5);
  });

  it("reports text with no JSON at all", () => {
    expect(parseTriageOutput("我觉得应该拒绝")).toEqual({
      error: "输出里没有 JSON 对象。"
    });
  });
});

describe("prompts", () => {
  it("puts the routing key first and the source URL in view", () => {
    const prompt = buildTriageUserPrompt(input);

    expect(prompt.startsWith("Purpose: candidate_triage")).toBe(true);
    expect(prompt).toContain("v0.34.3-rc0");
    expect(prompt).toContain("（订阅源没有提供摘要）");
  });

  it("shows each example with the editor's decision", () => {
    const examples: TriageExample[] = [
      { ...input, title: "某公司完成 B 轮融资", label: "reject" }
    ];
    const prompt = buildTriageSystemPrompt(examples);

    expect(prompt).toContain("某公司完成 B 轮融资");
    expect(prompt).toContain("编辑的处置: reject");
  });
});

describe("runCandidateTriage", () => {
  it("returns the suggestion with usage and latency", async () => {
    const result = await runCandidateTriage(
      input,
      [],
      providerReturning('{"decision":"reject","confidence":0.8,"reason":"rc"}')
    );

    expect(result.suggestion?.decision).toBe("reject");
    expect(result.tokenUsage?.totalTokens).toBe(15);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("turns a provider failure into an error result rather than throwing", async () => {
    const failing: LlmProvider = {
      ...providerReturning(""),
      generate: async () => {
        throw new Error("Provider returned HTTP 429.");
      }
    };
    const result = await runCandidateTriage(input, [], failing);

    expect(result.suggestion).toBeUndefined();
    expect(result.error).toBe("Provider returned HTTP 429.");
  });
});
