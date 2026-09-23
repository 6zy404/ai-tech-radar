/**
 * Pure citation handling for 问雷达. No server imports: the page renders
 * answers with the same splitter the eval scores them with.
 */

/**
 * The exact opening the model is told to use when the site has nothing that
 * answers the question. A fixed phrase makes "did it decline?" a string check
 * instead of a judgment call, so the eval can count it without a second model.
 */
export const askRefusalPrefix = "站内没有直接相关的内容";

export type AnswerPart =
  { type: "text"; value: string } | { type: "cite"; ref: number };

const citationPattern = /\[(\d{1,3})\]/g;

export function splitAnswerWithCitations(text: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;

  for (const match of text.matchAll(citationPattern)) {
    const index = match.index ?? 0;

    if (index > last) {
      parts.push({ type: "text", value: text.slice(last, index) });
    }

    parts.push({ type: "cite", ref: Number(match[1]) });
    last = index + match[0].length;
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }

  return parts;
}

/** Cited reference numbers, in order of first appearance. */
export function extractCitations(text: string): number[] {
  const seen = new Set<number>();

  for (const part of splitAnswerWithCitations(text)) {
    if (part.type === "cite") {
      seen.add(part.ref);
    }
  }

  return [...seen];
}

export interface CitationCheck {
  cited: number[];
  /** Numbers that no tool result in this conversation carried. */
  invalid: number[];
}

export function checkCitations(
  text: string,
  validRefs: ReadonlySet<number>
): CitationCheck {
  const cited = extractCitations(text);

  return { cited, invalid: cited.filter((ref) => !validRefs.has(ref)) };
}

export function isRefusal(text: string): boolean {
  return text.trimStart().startsWith(askRefusalPrefix);
}
