import { toChineseQuotes } from "@/lib/candidate-llm-draft";
import { parseLlmJsonObject } from "@/lib/llm/output-sanitization";
import type { LlmProvider, LlmTokenUsage } from "@/lib/llm/provider";
import { containsInternalPublicCopy } from "@/lib/public-copy";

/**
 * AI 起草导语: a model drafts the editorial overview of a set of published
 * signals — a digest issue's 今日概览 (`DailyDigest.editorialSummary`) or a
 * week's 本周总结 (`weekly-summary.ts`). The editor reads, edits and saves it;
 * nothing here writes to a store.
 *
 * Pure apart from the injected provider: the prompt, the validator and one
 * generation call. The prompt versions are code constants for the same reason
 * as `CANDIDATE_DRAFT_PROMPT_VERSION`: what a draft records about the prompt
 * that wrote it must not be editable after the fact.
 */
export const DIGEST_SUMMARY_PROMPT_VERSION = "digest-summary-v1";
export const WEEKLY_SUMMARY_PROMPT_VERSION = "weekly-summary-v1";

export type OverviewKind = "digest" | "weekly";

export const overviewPromptVersions: Record<OverviewKind, string> = {
  digest: DIGEST_SUMMARY_PROMPT_VERSION,
  weekly: WEEKLY_SUMMARY_PROMPT_VERSION
};

/** The first line of the user prompt; doubles as the mock's routing key. */
export const overviewPurposes: Record<OverviewKind, string> = {
  digest: "digest_editorial_summary",
  weekly: "weekly_summary"
};

export type OverviewSection = "立即关注" | "值得跟踪";

export interface OverviewSignal {
  section: OverviewSection;
  title: string;
  summary: string;
  whyItMatters?: string;
  publisherName?: string;
  publishDate: string;
}

export interface OverviewInput {
  /** 「2026-10-13 这一期」/「10 月 6 日 – 10 月 12 日这一周」. */
  label: string;
  signals: OverviewSignal[];
}

export const OVERVIEW_LIMITS = {
  digest: { min: 120, max: 420 },
  weekly: { min: 160, max: 600 }
} as const;

const SIGNAL_PROMPT_LIMIT = 24;
const allowedFields = new Set(["editorialSummary", "limitations"]);

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

const sharedRules = `## 事实

- 只用下面给出的标题、摘要、为什么重要里的事实和数字，不要补充站外知识，不要推测原文没说的结论。
- 提到一条信号时，用发布方加产品或成果的名字（例如「Anthropic 的 Sonnet 5.5」），读者没看过原文也能认出是哪一条。
- 数字照抄，单位和比较对象要写清楚（「比 Opus 便宜一半」，不是「更便宜」）。

## 写法

- 先找这几条信号的共同线索：它们在回答同一个问题、指向同一种取舍，或者互相印证、互相矛盾。有就用一句话点明，再用各条信号的事实撑起来；找不到就按重要程度逐条交代，不要硬凑主题。
- 「立即关注」的信号写得比「值得跟踪」的多；值得跟踪的可以几条合成一句。
- 不写空话：不要「值得关注」「意义重大」「引发热议」「让我们拭目以待」，不要评价本站或编辑。
- 全部用简体中文，约定俗成的技术词和产品名保留原文。引号用「」。中文与英文、数字之间加一个空格。
- 纯文本段落，段落之间空一行。不用标题、列表、链接、表格、代码；最多一处 **加粗**，也可以不用。
- 不要出现 demo、mock、test、internal、workspace、validation 这几个英文词：公开页遇到它们会整段隐藏。

只输出一个 JSON 对象：{"editorialSummary": "…", "limitations": ["…"]}。limitations 是 0 到 2 条给编辑的提醒（例如哪条信号的信息不够、哪个数字要核对），不会公开。`;

const rubrics: Record<OverviewKind, string> = {
  digest: `你是一个中文技术雷达站的编辑。这个站每期「技术简报」挑出几条已发布的技术信号，分成「立即关注」和「值得跟踪」两组。现在请你为这一期写开头的「今日概览」：读者只读这一段，就知道这一期讲了什么、哪条最该先看、为什么。

## 长度

- ${OVERVIEW_LIMITS.digest.min} 到 300 字，一到三段。

${sharedRules}`,
  weekly: `你是一个中文技术雷达站的编辑。站点每周有一页「本周回顾」，按优先级列出这一周（周一到周日）发布的所有技术信号。现在请你为这一周写一段「本周总结」，放在列表上面：读者只读这一段，就知道这一周发生了什么、几条信号之间有什么联系、哪些最该先看。

## 长度

- ${OVERVIEW_LIMITS.weekly.min} 到 450 字，两到三段。信号多时不必每条都提，挑能说明问题的。

${sharedRules}`
};

export function buildOverviewSystemPrompt(kind: OverviewKind): string {
  return rubrics[kind];
}

export function buildOverviewUserPrompt(
  kind: OverviewKind,
  input: OverviewInput
): string {
  const signals = input.signals.slice(0, SIGNAL_PROMPT_LIMIT);
  const lines = [
    `Purpose: ${overviewPurposes[kind]}`,
    "",
    `范围: ${input.label}`,
    `信号数: ${input.signals.length}${input.signals.length > signals.length ? `（下面只列前 ${signals.length} 条）` : ""}`,
    ""
  ];

  signals.forEach((signal, index) => {
    lines.push(
      `### ${index + 1}. [${signal.section}] ${clip(signal.title, 120)}`,
      `发布方: ${signal.publisherName || "未知"} · 发布日期: ${signal.publishDate}`,
      `摘要: ${clip(signal.summary, 360)}`
    );

    if (signal.whyItMatters) {
      lines.push(`为什么重要: ${clip(signal.whyItMatters, 300)}`);
    }

    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

/**
 * What `ContentBody` renders for these strings: paragraphs and `**bold**`.
 * Headings, list markers, links, code and tables are flattened to text, and
 * the quotes converted, so what the editor sees is what readers would get.
 */
export function cleanOverviewText(raw: string): string {
  return toChineseQuotes(
    raw
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter((line) => !/^\s*\|.*\|\s*$/.test(line))
      .map((line) =>
        line
          .replace(/^\s*#{1,6}\s+/, "")
          .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
          .replace(/^\s*>\s?/, "")
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim()
      )
      .join("\n")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cutAtSentence(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const head = text.slice(0, limit);
  const stop = Math.max(
    head.lastIndexOf("。"),
    head.lastIndexOf("！"),
    head.lastIndexOf("？")
  );

  return stop > limit / 2 ? head.slice(0, stop + 1) : head;
}

export type ValidatedOverview =
  | { ok: true; text: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

export function validateOverviewOutput(
  rawText: string,
  kind: OverviewKind
): ValidatedOverview {
  const parsed = parseLlmJsonObject(rawText, allowedFields);

  if (!parsed.ok) {
    return { ok: false, error: parsed.error, warnings: [] };
  }

  const warnings = [...parsed.warnings];
  const raw = parsed.record.editorialSummary;
  let text = typeof raw === "string" ? cleanOverviewText(raw) : "";

  if (!text) {
    return { ok: false, error: "模型没有给出导语。", warnings };
  }

  const { min, max } = OVERVIEW_LIMITS[kind];

  if (text.length > max) {
    text = cutAtSentence(text, max);
    warnings.push(`导语超过 ${max} 字，已在句末截断。`);
  } else if (text.length < min) {
    warnings.push(`导语只有 ${text.length} 字，偏短。`);
  }

  if (containsInternalPublicCopy(text)) {
    warnings.push(
      "导语里有 demo / mock / test 之类的英文词，公开页会整段隐藏，保存前请改掉。"
    );
  }

  const limitations = parsed.record.limitations;

  if (Array.isArray(limitations)) {
    for (const item of limitations.slice(0, 2)) {
      if (typeof item === "string" && item.trim()) {
        warnings.push(`模型注明：${clip(item, 120)}`);
      }
    }
  }

  return { ok: true, text, warnings };
}

export interface OverviewDraftMetadata {
  providerName: string;
  modelName: string;
  promptVersion: string;
  generatedAt: string;
  latencyMs: number;
  tokenUsage?: LlmTokenUsage;
}

export type OverviewDraftResult =
  | {
      ok: true;
      text: string;
      warnings: string[];
      metadata: OverviewDraftMetadata;
    }
  | { ok: false; status: number; error: string; metadata?: { modelName: string; latencyMs: number } };

const OVERVIEW_LLM_TIMEOUT_MS = 90000;

export async function draftOverview(
  kind: OverviewKind,
  input: OverviewInput,
  provider: LlmProvider,
  timeoutMs = OVERVIEW_LLM_TIMEOUT_MS
): Promise<OverviewDraftResult> {
  if (input.signals.length === 0) {
    return { ok: false, status: 409, error: "没有选中的信号，写不出导语。" };
  }

  const startedAt = Date.now();
  let response;

  try {
    response = await provider.generate({
      systemPrompt: buildOverviewSystemPrompt(kind),
      userPrompt: buildOverviewUserPrompt(kind, input),
      timeoutMs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      status: 502,
      error: `AI 起草导语失败：模型调用出错（${message}）。`,
      metadata: {
        modelName: provider.modelName,
        latencyMs: Date.now() - startedAt
      }
    };
  }

  const latencyMs = Date.now() - startedAt;
  const validated = validateOverviewOutput(response.text, kind);

  if (!validated.ok) {
    return {
      ok: false,
      status: 422,
      error: `AI 起草导语失败：${validated.error} 可以再试一次。`,
      metadata: { modelName: response.modelName, latencyMs }
    };
  }

  return {
    ok: true,
    text: validated.text,
    warnings: validated.warnings,
    metadata: {
      providerName: response.providerName,
      modelName: response.modelName,
      promptVersion: overviewPromptVersions[kind],
      generatedAt: new Date().toISOString(),
      latencyMs,
      ...(response.tokenUsage ? { tokenUsage: response.tokenUsage } : {})
    }
  };
}
