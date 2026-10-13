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

interface FormattedAnswer {
  paragraphs: string[];
  /** Cited numbers that cannot be linked, in order of first appearance. */
  invalidSeen: number[];
  /** The page's 引用 block for this answer: same set and order. */
  citedSources: AskCopySource[];
}

function formatAnswer(
  input: Pick<AskCopyInput, "answer" | "sources" | "cited" | "invalid">
): FormattedAnswer {
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

  const citedSources = input.sources.filter(
    (source) =>
      input.cited.includes(source.ref) &&
      !isInvalidCitation(source.ref, sourceRefs, input.invalid)
  );

  return { paragraphs, invalidSeen, citedSources };
}

function formatSourceLine(source: AskCopySource, origin: string): string {
  return `[${source.ref}] ${source.title}（${askSourceKindLabels[source.kind]}） ${toAbsoluteUrl(source.href, origin)}`;
}

function formatInvalidNote(invalid: number[]): string {
  return `注：${invalid.map((ref) => `[${ref}?]`).join("、")} 不对应任何检索到的条目，是无效编号。`;
}

export function buildAskCopyText(input: AskCopyInput): string {
  const { paragraphs, invalidSeen, citedSources } = formatAnswer(input);
  const sections: string[] = [`问：${input.question.trim()}`];

  if (paragraphs.length > 0) {
    sections.push(paragraphs.join("\n\n"));
  }

  if (citedSources.length > 0) {
    sections.push(
      [
        "出处：",
        ...citedSources.map((source) => formatSourceLine(source, input.origin))
      ].join("\n")
    );
  }

  if (invalidSeen.length > 0) {
    sections.push(formatInvalidNote(invalidSeen));
  }

  sections.push(input.disclaimer);

  return sections.join("\n\n");
}

/** One finished turn of a 问雷达 conversation, as the page holds it. */
export interface AskCopyTurn {
  question: string;
  answer: string;
  /** The conversation's sources as of this turn (numbers never restart). */
  sources: readonly AskCopySource[];
  cited: readonly number[];
  invalid: readonly number[];
}

/**
 * 复制整段对话: every turn's question and answer in order, then one 出处
 * list for the whole conversation (each item once, by number — numbers
 * never restart within a conversation), then the disclaimer once. Each turn
 * is checked against its own sources, so a number one turn could not link
 * stays `[n?]` even if a later turn retrieved an item under it. A single
 * turn copies exactly as `buildAskCopyText` does.
 */
export function buildAskConversationCopyText(input: {
  turns: readonly AskCopyTurn[];
  origin: string;
  disclaimer: string;
}): string {
  const [first, ...rest] = input.turns;

  if (!first) {
    return input.disclaimer;
  }

  if (rest.length === 0) {
    return buildAskCopyText({
      ...first,
      origin: input.origin,
      disclaimer: input.disclaimer
    });
  }

  const sections: string[] = [];
  const cited = new Map<number, AskCopySource>();
  const invalid: number[] = [];

  input.turns.forEach((turn, index) => {
    const formatted = formatAnswer(turn);

    if (index > 0) {
      sections.push("——");
    }

    sections.push(`${index === 0 ? "问" : "追问"}：${turn.question.trim()}`);

    if (formatted.paragraphs.length > 0) {
      sections.push(formatted.paragraphs.join("\n\n"));
    }

    for (const source of formatted.citedSources) {
      cited.set(source.ref, source);
    }

    for (const ref of formatted.invalidSeen) {
      if (!invalid.includes(ref)) {
        invalid.push(ref);
      }
    }
  });

  if (cited.size > 0) {
    sections.push(
      [
        "出处：",
        ...[...cited.values()]
          .sort((a, b) => a.ref - b.ref)
          .map((source) => formatSourceLine(source, input.origin))
      ].join("\n")
    );
  }

  if (invalid.length > 0) {
    sections.push(formatInvalidNote(invalid));
  }

  sections.push(input.disclaimer);

  return sections.join("\n\n");
}
