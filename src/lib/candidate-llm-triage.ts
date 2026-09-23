import type { LlmProvider, LlmTokenUsage } from "@/lib/llm/provider";

/**
 * LLM candidate triage: a model reads one imported candidate and suggests
 * what an editor would do with it — publish, review (looked at, not selected)
 * or reject.
 *
 * It is a suggestion only. Nothing here changes a candidate's status; the
 * editor still clicks. That boundary is the point: `AGENTS.md` keeps
 * black-box ranking out of scope, and the only automated rejections this
 * project makes are the two factual flags in `candidate-auto-triage.ts`.
 *
 * The prompt version is a code constant rather than a `PromptVersion` store
 * record on purpose. The eval (`npm run eval:triage`) reports numbers for a
 * version, and a store record can be edited after the fact — a number that
 * outlives the prompt it measured is worse than no number.
 */

export const TRIAGE_PROMPT_VERSION = "candidate-triage-v1";

export const triageLabels = ["publish", "review", "reject"] as const;

export type TriageLabel = (typeof triageLabels)[number];

export const triageLabelNames: Record<TriageLabel, string> = {
  publish: "发布",
  review: "标记已看",
  reject: "拒绝"
};

export interface TriageInput {
  title: string;
  summary: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  publisherName: string;
  publishDate: string;
}

export interface TriageExample extends TriageInput {
  label: TriageLabel;
}

export interface TriageSuggestion {
  decision: TriageLabel;
  confidence: number;
  reason: string;
}

export interface TriageRunResult {
  suggestion?: TriageSuggestion;
  error?: string;
  providerName: string;
  modelName: string;
  tokenUsage?: LlmTokenUsage;
  latencyMs: number;
}

const FIELD_LIMIT = 500;
const REASON_LIMIT = 160;

const rubric = `你是一个中文技术雷达站的编辑助理。这个站不是 AI 新闻门户：它只发布「值得工程团队优先关注的新技术信号」，并解释它为什么重要。每天导入的候选里，大多数都会被拒绝。

对一条候选，给出编辑最可能的处置，三选一：

- publish（发布）：有可核对的实物或数据的新进展，会影响工程团队的判断。例如：开源模型或权重、协议与规范的实质修订、推理引擎的实质能力版本、带数字的评测、带失败细节的工程复盘、一手研究结果。
- review（标记已看，不选）：主题相关但这次不发。例如：与已发布内容讲同一件事、原文只剩一句话无法核对、只有论述没有实物、演示而不是评估、补丁版本、用法教程。
- reject（拒绝）：不属于本站。例如：融资、财报、人事、营销与客户案例、消费级产品公告、会议推广与邀请、预发布版本（rc / beta / pre）、与 AI 工程无关的内容、政策公关稿。

注意：
- 你只能看到订阅源里的标题和摘要，编辑还读过原文。信息不足时，倾向 review 而不是 publish。
- 标题像版本号时，看链接里的 tag：标题写 v0.34.3 而 tag 是 v0.34.3-rc0 的，是预发布版本。

只输出一个 JSON 对象：{"decision":"publish|review|reject","confidence":0 到 1 之间的数,"reason":"一句中文理由，不超过 60 字"}`;

function clip(value: string, limit = FIELD_LIMIT): string {
  const text = value.replace(/\s+/g, " ").trim();

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function describeCandidate(input: TriageInput): string {
  const body = input.summary || input.content;

  return [
    `标题: ${clip(input.title, 200)}`,
    `来源: ${input.sourceName}${input.publisherName && input.publisherName !== input.sourceName ? ` / ${input.publisherName}` : ""}`,
    `链接: ${input.sourceUrl}`,
    `发布日期: ${input.publishDate || "未知"}`,
    `摘要: ${body ? clip(body) : "（订阅源没有提供摘要）"}`
  ].join("\n");
}

export function buildTriageSystemPrompt(examples: TriageExample[]): string {
  if (examples.length === 0) {
    return rubric;
  }

  const shown = examples
    .map(
      (example, index) =>
        `示例 ${index + 1}\n${describeCandidate(example)}\n编辑的处置: ${example.label}`
    )
    .join("\n\n");

  return `${rubric}\n\n以下是编辑过去的真实处置，供你校准标准：\n\n${shown}`;
}

/**
 * The first line doubles as the mock provider's routing key, the same
 * convention the three technology prompts use.
 */
export function buildTriageUserPrompt(input: TriageInput): string {
  return `Purpose: candidate_triage\n\n${describeCandidate(input)}`;
}

function isTriageLabel(value: unknown): value is TriageLabel {
  return (
    typeof value === "string" &&
    (triageLabels as readonly string[]).includes(value)
  );
}

/**
 * Strict on the one field that matters and lenient on the rest: an unknown
 * decision is an error, but a missing confidence becomes 0.5 and an overlong
 * reason is cut rather than rejected.
 */
export function parseTriageOutput(
  text: string
): { suggestion: TriageSuggestion } | { error: string } {
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    return { error: "输出里没有 JSON 对象。" };
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return { error: "输出的 JSON 无法解析。" };
  }

  const decision =
    typeof parsed.decision === "string"
      ? parsed.decision.trim().toLowerCase()
      : parsed.decision;

  if (!isTriageLabel(decision)) {
    return { error: `未知的处置：${String(parsed.decision)}` };
  }

  const rawConfidence = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5;
  const reason =
    typeof parsed.reason === "string" ? clip(parsed.reason, REASON_LIMIT) : "";

  return { suggestion: { decision, confidence, reason } };
}

export async function runCandidateTriage(
  input: TriageInput,
  examples: TriageExample[],
  provider: LlmProvider,
  options: { timeoutMs?: number } = {}
): Promise<TriageRunResult> {
  const startedAt = Date.now();

  try {
    const response = await provider.generate({
      systemPrompt: buildTriageSystemPrompt(examples),
      userPrompt: buildTriageUserPrompt(input),
      timeoutMs: options.timeoutMs ?? 30000
    });
    const parsed = parseTriageOutput(response.text);

    return {
      ...parsed,
      providerName: response.providerName,
      modelName: response.modelName,
      tokenUsage: response.tokenUsage,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "模型调用失败。",
      providerName: provider.name,
      modelName: provider.modelName,
      latencyMs: Date.now() - startedAt
    };
  }
}
