import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
  parseTriageOutput,
  runCandidateTriage,
  selectRecentPublishedTitles,
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

describe("prompt versions", () => {
  const fewShot = JSON.parse(
    fs.readFileSync(path.join("eval", "triage", "fewshot.json"), "utf8")
  ) as TriageExample[];
  const hash = (text: string) =>
    crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

  // Reported numbers belong to the exact text. These hashes were taken before
  // v3 was added; a change here means v1 or v2 no longer matches its results.
  it("keeps v1 and v2 byte for byte", () => {
    expect(hash(buildTriageSystemPrompt(fewShot, "candidate-triage-v1"))).toBe(
      "600c6d46c849d2ac"
    );
    expect(hash(buildTriageSystemPrompt(fewShot, "candidate-triage-v2"))).toBe(
      "cc6a9ba4fc7efd10"
    );
  });

  it("shows published titles to v3 only", () => {
    const titles = [
      {
        title: "某模型发布",
        originalTitle: "Model X released",
        publishedOn: "2026-10-01"
      }
    ];
    const v2 = buildTriageSystemPrompt([], "candidate-triage-v2");
    const v3 = buildTriageSystemPrompt([], "candidate-triage-v3", titles);

    expect(buildTriageSystemPrompt([], "candidate-triage-v2", titles)).toBe(v2);
    expect(v3).toContain("本站只覆盖 AI 技术");
    expect(v3).toContain("- 2026-10-01 某模型发布 / Model X released");
    expect(v3.endsWith("- 2026-10-01 某模型发布 / Model X released")).toBe(
      true
    );
    // v3 calls a second report "reject", so its review list must not say
    // "review" for the same thing.
    expect(v2).toContain("与已发布内容讲同一件事");
    expect(v3).not.toContain("与已发布内容讲同一件事");
  });

  it("says so when nothing was published in the window", () => {
    expect(buildTriageSystemPrompt([], "candidate-triage-v3")).toContain(
      "（这段时间没有发布）"
    );
  });
});

describe("selectRecentPublishedTitles", () => {
  const record = (
    createdAt: string,
    title: { original: string; zh?: string },
    extra: { status?: string; sourceCandidateId?: string } = {}
  ) => ({ title, createdAt, status: "published", ...extra });

  it("keeps the 30 days before the decision, newest first, nothing after", () => {
    const titles = selectRecentPublishedTitles(
      [
        record("2026-09-01T00:00:00.000Z", { original: "too old" }),
        record("2026-09-20T00:00:00.000Z", { original: "older" }),
        record("2026-10-01T00:00:00.000Z", { original: "newer" }),
        record("2026-10-02T00:00:00.000Z", { original: "same instant" }),
        record("2026-10-03T00:00:00.000Z", { original: "future" })
      ],
      "2026-10-02T00:00:00.000Z"
    );

    expect(titles.map((title) => title.title)).toEqual(["newer", "older"]);
  });

  it("skips unpublished records and the candidate's own signal", () => {
    const titles = selectRecentPublishedTitles(
      [
        record(
          "2026-10-01T00:00:00.000Z",
          { original: "draft" },
          {
            status: "draft"
          }
        ),
        record(
          "2026-10-01T00:00:00.000Z",
          { original: "itself" },
          {
            sourceCandidateId: "candidate-a"
          }
        ),
        record(
          "2026-10-01T00:00:00.000Z",
          { original: "other" },
          {
            sourceCandidateId: "candidate-b"
          }
        )
      ],
      "2026-10-02T00:00:00.000Z",
      { excludeCandidateId: "candidate-a" }
    );

    expect(titles.map((title) => title.title)).toEqual(["other"]);
  });

  it("prefers the Chinese title and adds the original only when it differs", () => {
    const [translated, plain] = selectRecentPublishedTitles(
      [
        record("2026-10-01T00:00:00.000Z", {
          original: "Model X",
          zh: "模型 X"
        }),
        record("2026-09-30T00:00:00.000Z", { original: "同一个", zh: "同一个" })
      ],
      "2026-10-02T00:00:00.000Z"
    );

    expect(translated).toEqual({
      title: "模型 X",
      originalTitle: "Model X",
      publishedOn: "2026-10-01"
    });
    expect(plain).toEqual({ title: "同一个", publishedOn: "2026-09-30" });
  });
});

describe("runCandidateTriage with v3", () => {
  it("passes the published titles into the system prompt", async () => {
    let systemPrompt = "";
    const provider: LlmProvider = {
      ...providerReturning(
        '{"decision":"reject","confidence":0.9,"reason":"重复"}'
      ),
      generate: async (request) => {
        systemPrompt = request.systemPrompt;
        return {
          text: '{"decision":"reject","confidence":0.9,"reason":"重复"}',
          providerName: "test",
          modelName: "test-model"
        };
      }
    };

    await runCandidateTriage(input, [], provider, {
      promptVersion: "candidate-triage-v3",
      publishedTitles: [{ title: "已发布的那条", publishedOn: "2026-10-01" }]
    });

    expect(systemPrompt).toContain("- 2026-10-01 已发布的那条");
  });
});
