/**
 * The 复制答案 text for 问雷达: the question, the answer as the page shows
 * it, the cited sources with absolute links and the AI disclaimer. Pure and
 * client-safe — everything it formats is already on the page, so copying
 * never needs another request.
 */

import { splitAnswerWithCitations } from "@/lib/ask-radar-citations";

export type AskCopySourceKind = "technology" | "skill" | "knowledge";

/** The fields of an `AskSource` the copy needs (kept structural so this file
 * never imports the server module). */
export interface AskCopySource {
  ref: number;
  kind: AskCopySourceKind;
  title: string;
  href: string;
}

export const askSourceKindLabels: Record<AskCopySourceKind, string> = {
  technology: "技术信号",
  skill: "技能",
  knowledge: "知识"
};

/**
 * The answer's paragraphs exactly as the page renders them: bold markers
 * dropped, one paragraph per run of line breaks, blanks removed.
 */
export function toAnswerParagraphs(answer: string): string[] {
  return answer
    .replace(/\*\*/g, "")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * A citation the page cannot link — no retrieved item carries the number, or
 * the server flagged it — is struck through there and must not read as a
 * working reference here.
 */
export function isInvalidCitation(
  ref: number,
  sourceRefs: ReadonlySet<number>,
  invalid: readonly number[]
): boolean {
  return !sourceRefs.has(ref) || invalid.includes(ref);
}

export function toAbsoluteUrl(href: string, origin: string): string {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}

export interface AskCopyInput {
  question: string;
  answer: string;
  /** Every retrieved item, as the `sources` event delivered them. */
  sources: readonly AskCopySource[];
  /** Reference numbers the answer cites, from the `done` event. */
  cited: readonly number[];
  /** Cited numbers the server could not match, from the `done` event. */
  invalid: readonly number[];
  /** The site origin links are resolved against, e.g. `https://aizyradar.cn`. */
  origin: string;
  disclaimer: string;
}

export function buildAskCopyText(input: AskCopyInput): string {
  const sourceRefs = new Set(input.sources.map((source) => source.ref));
  const invalidSeen: number[] = [];

  const paragraphs = toAnswerParagraphs(input.answer).map((paragraph) =>
    splitAnswerWithCitations(paragraph)
      .map((part) => {
        if (part.type === "text") {
          return part.value;
        }

        if (isInvalidCitation(part.ref, sourceRefs, input.invalid)) {
          if (!invalidSeen.includes(part.ref)) {
            invalidSeen.push(part.ref);
          }

          return `[${part.ref}?]`;
        }

        return `[${part.ref}]`;
      })
      .join("")
  );

  const sections: string[] = [`问：${input.question.trim()}`];

  if (paragraphs.length > 0) {
    sections.push(paragraphs.join("\n\n"));
  }

  // Same set and order as the page's 引用 block.
  const citedSources = input.sources.filter(
    (source) =>
      input.cited.includes(source.ref) &&
      !isInvalidCitation(source.ref, sourceRefs, input.invalid)
  );

  if (citedSources.length > 0) {
    sections.push(
      [
        "出处：",
        ...citedSources.map(
          (source) =>
            `[${source.ref}] ${source.title}（${askSourceKindLabels[source.kind]}） ${toAbsoluteUrl(source.href, input.origin)}`
        )
      ].join("\n")
    );
  }

  if (invalidSeen.length > 0) {
    sections.push(
      `注：${invalidSeen.map((ref) => `[${ref}?]`).join("、")} 不对应任何检索到的条目，是无效编号。`
    );
  }

  sections.push(input.disclaimer);

  return sections.join("\n\n");
}
