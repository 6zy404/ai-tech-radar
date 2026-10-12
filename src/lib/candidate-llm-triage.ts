import type { LlmProvider, LlmTokenUsage } from "@/lib/llm/provider";
import type { LocalizedText } from "@/types/content";

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

export const TRIAGE_PROMPT_VERSIONS = [
  "candidate-triage-v1",
  // v2 adds the opening of the primary source (candidate-article.ts) and
  // tells the model to judge on it. Evaluated before it replaces v1.
  "candidate-triage-v2",
  // v3 keeps v2's article reading and adds two things the 2026-10-12 re-check
  // pointed at: the site's AI-only scope, and the titles the site published
  // in the last 30 days. Not the console's version until the owner decides
  // (eval/triage/README.md → "Prompt v3").
  "candidate-triage-v3"
] as const;

export type TriagePromptVersion = (typeof TRIAGE_PROMPT_VERSIONS)[number];

/** The version the workspace console uses. */
export const TRIAGE_PROMPT_VERSION: TriagePromptVersion = "candidate-triage-v2";

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
  /** v2 only: the article's opening, or why it could not be read. */
  articleExcerpt?: string;
  articleError?: string;
}

/** One already-published signal, as v3 shows it to the model. */
export interface PublishedSignalTitle {
  title: string;
  /** The original-language title, when it differs from `title`. */
  originalTitle?: string;
  /** The day it went on the site, YYYY-MM-DD. */
  publishedOn: string;
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

const rubricHead = `你是一个中文技术雷达站的编辑助理。这个站不是 AI 新闻门户：它只发布「值得工程团队优先关注的新技术信号」，并解释它为什么重要。每天导入的候选里，大多数都会被拒绝。

对一条候选，给出编辑最可能的处置，三选一：

- publish（发布）：有可核对的实物或数据的新进展，会影响工程团队的判断。例如：开源模型或权重、协议与规范的实质修订、推理引擎的实质能力版本、带数字的评测、带失败细节的工程复盘、一手研究结果。
- review（标记已看，不选）：主题相关但这次不发。例如：与已发布内容讲同一件事、原文只剩一句话无法核对、只有论述没有实物、演示而不是评估、补丁版本、用法教程。
- reject（拒绝）：不属于本站。例如：融资、财报、人事、营销与客户案例、消费级产品公告、会议推广与邀请、预发布版本（rc / beta / pre）、与 AI 工程无关的内容、政策公关稿。

注意：`;

// v3 moves "the same story as something already published" from review to
// reject, so its head drops that review example; v1 and v2 keep theirs.
const rubricHeadV3 = rubricHead.replace("与已发布内容讲同一件事、", "");

const readingNote: Record<TriagePromptVersion, string> = {
  "candidate-triage-v1":
    "- 你只能看到订阅源里的标题和摘要，编辑还读过原文。信息不足时，倾向 review 而不是 publish。",
  "candidate-triage-v2":
    "- 每条候选附有原文开头的摘录（取不到时会注明原因）。以原文为准判断有没有可核对的实物或数据，不要因为订阅源的摘要短就给 review；只有原文也取不到、信息确实不足时，才倾向 review。",
  "candidate-triage-v3":
    "- 每条候选附有原文开头的摘录（取不到时会注明原因）。以原文为准判断有没有可核对的实物或数据，不要因为订阅源的摘要短就给 review；只有原文也取不到、信息确实不足时，才倾向 review。"
};

export const PUBLISHED_TITLES_WINDOW_DAYS = 30;

const scopeNoteV3 =
  "- 本站只覆盖 AI 技术：模型、智能体、推理与部署、AI 工程工具链、AI 研究。前端框架、编程语言、通用开发工具这类与 AI 无关的工程内容，即使是有实物、有数据的大版本，也给 reject；只有内容本身是 AI 能力时，才按上面的标准判断。";

const publishedNoteV3 = `- 系统提示的末尾列出本站最近 ${PUBLISHED_TITLES_WINDOW_DAYS} 天已发布的信号。候选报道的如果是其中某条的同一件事（同一次发布、同一篇论文、同一个事件，哪怕来自另一家媒体、换了标题或语言），给 reject；同一产品线的下一个版本、或同一主题的另一项新进展，不算同一件事。`;

const rubricTail = `- 标题像版本号时，看链接里的 tag：标题写 v0.34.3 而 tag 是 v0.34.3-rc0 的，是预发布版本。

只输出一个 JSON 对象：{"decision":"publish|review|reject","confidence":0 到 1 之间的数,"reason":"一句中文理由，不超过 60 字"}`;

function clip(value: string, limit = FIELD_LIMIT): string {
  const text = value.replace(/\s+/g, " ").trim();

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function buildRubric(version: TriagePromptVersion): string {
  if (version === "candidate-triage-v3") {
    return [
      rubricHeadV3,
      readingNote[version],
      scopeNoteV3,
      publishedNoteV3,
      rubricTail
    ].join("\n");
  }

  return [rubricHead, readingNote[version], rubricTail].join("\n");
}

// Last in the system prompt, after the examples: the rubric and examples stay
// a stable prefix, and only this list moves with the date.
function describePublishedTitles(titles: PublishedSignalTitle[]): string {
  const lines = titles.map(
    (signal) =>
      `- ${signal.publishedOn} ${clip(signal.title, 120)}${signal.originalTitle ? ` / ${clip(signal.originalTitle, 120)}` : ""}`
  );

  return `本站最近 ${PUBLISHED_TITLES_WINDOW_DAYS} 天已发布的信号：\n\n${lines.length > 0 ? lines.join("\n") : "（这段时间没有发布）"}`;
}

interface PublishedRecordLike {
  title: LocalizedText;
  status: string;
  createdAt: string;
  sourceCandidateId?: string;
}

/**
 * The published signals a v3 prompt shows: those that went on the site in the
 * `windowDays` before `asOf`, newest first. A record counts from its
 * `createdAt`, the moment its candidate was converted (measured equal to the
 * decision time on all 107 published records). `excludeCandidateId` keeps a
 * candidate from seeing the signal it became — in the eval that record sits
 * 3ms before its own decision.
 */
export function selectRecentPublishedTitles(
  records: PublishedRecordLike[],
  asOf: string,
  options: { windowDays?: number; excludeCandidateId?: string } = {}
): PublishedSignalTitle[] {
  const end = Date.parse(asOf);
  const start =
    end - (options.windowDays ?? PUBLISHED_TITLES_WINDOW_DAYS) * 86_400_000;

  return records
    .filter((record) => {
      const at = Date.parse(record.createdAt);

      return (
        record.status === "published" &&
        at < end &&
        at >= start &&
        (!options.excludeCandidateId ||
          record.sourceCandidateId !== options.excludeCandidateId)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record) => {
      const title = (record.title.zh || record.title.original).trim();
      const original = record.title.original.trim();

      return {
        title,
        ...(original && original !== title ? { originalTitle: original } : {}),
        publishedOn: record.createdAt.slice(0, 10)
      };
    });
}

function describeCandidate(input: TriageInput): string {
  const body = input.summary || input.content;
  const lines = [
    `标题: ${clip(input.title, 200)}`,
    `来源: ${input.sourceName}${input.publisherName && input.publisherName !== input.sourceName ? ` / ${input.publisherName}` : ""}`,
    `链接: ${input.sourceUrl}`,
    `发布日期: ${input.publishDate || "未知"}`,
    `摘要: ${body ? clip(body) : "（订阅源没有提供摘要）"}`
  ];

  // Only candidates that went through the fetch carry either field; the
  // few-shot examples do not, and print no excerpt line at all.
  if (input.articleExcerpt) {
    lines.push(`原文摘录: ${input.articleExcerpt}`);
  } else if (input.articleError) {
    lines.push(`原文摘录: （取不到：${input.articleError}）`);
  }

  return lines.join("\n");
}

export function buildTriageSystemPrompt(
  examples: TriageExample[],
  version: TriagePromptVersion = TRIAGE_PROMPT_VERSION,
  publishedTitles: PublishedSignalTitle[] = []
): string {
  const rubric = buildRubric(version);
  const published =
    version === "candidate-triage-v3"
      ? `\n\n${describePublishedTitles(publishedTitles)}`
      : "";

  if (examples.length === 0) {
    return `${rubric}${published}`;
  }

  const shown = examples
    .map(
      (example, index) =>
        `示例 ${index + 1}\n${describeCandidate(example)}\n编辑的处置: ${example.label}`
    )
    .join("\n\n");

  return `${rubric}\n\n以下是编辑过去的真实处置，供你校准标准：\n\n${shown}${published}`;
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
  options: {
    timeoutMs?: number;
    promptVersion?: TriagePromptVersion;
    /** Shown by v3 only; v1 and v2 ignore it. */
    publishedTitles?: PublishedSignalTitle[];
  } = {}
): Promise<TriageRunResult> {
  const startedAt = Date.now();

  try {
    const response = await provider.generate({
      systemPrompt: buildTriageSystemPrompt(
        examples,
        options.promptVersion,
        options.publishedTitles
      ),
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
