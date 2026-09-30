import { highlightSearchTerms } from "@/lib/search-highlight";

/**
 * The 原标题 line on a search result (2026-09-30).
 *
 * Keyword search matches a signal's title in both languages, but the card
 * shows only the preferred (usually Chinese) one. A query like `agent` found
 * 「智能体…」 through its English title and left nothing marked on the card,
 * so the reader could not tell why it was there. When a term hits the
 * original title and nothing the card displays, the card adds one line with
 * the original title, excerpted around the hit.
 */

/** Longest excerpt shown, ellipses included. 15 of 91 titles exceed it. */
export const originalTitleMaxLength = 72;

export interface OriginalTitleCardText {
  title: string;
  summary?: string;
  tags: string[];
  /** The title in the language the card does not show; absent when equal. */
  originalTitle?: string;
}

function containsTerm(text: string | undefined, term: string): boolean {
  return Boolean(text) && (text as string).toLowerCase().includes(term);
}

/**
 * The terms that hit the original title and appear nowhere on the card.
 * Judged per term, so for `agent 推理` a card with 推理 marked in its summary
 * still explains the `agent` it was also found by.
 */
export function findHiddenTitleTerms(
  card: OriginalTitleCardText,
  terms: string[]
): string[] {
  const { originalTitle } = card;

  if (!originalTitle) {
    return [];
  }

  const unique = [
    ...new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean))
  ];

  return unique.filter(
    (term) =>
      containsTerm(originalTitle, term) &&
      !containsTerm(card.title, term) &&
      !containsTerm(card.summary, term) &&
      !card.tags.some((tag) => containsTerm(tag, term))
  );
}

function matchRanges(text: string, terms: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let offset = 0;

  for (const segment of highlightSearchTerms(text, terms)) {
    if (segment.match) {
      ranges.push([offset, offset + segment.text.length]);
    }
    offset += segment.text.length;
  }

  return ranges;
}

const latinWordCharacter = /[\p{L}\p{N}]/u;
const edgePunctuation = /^[\s,;:，、；：。]+|[\s,;:，、；：]+$/g;

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Where a clause ends: CJK punctuation, or latin punctuation followed by a
 * space (so `30.9%` and `Apache 2.0` are not clause ends).
 */
function isClauseEnd(text: string, index: number): boolean {
  return (
    /[。！？；，、：]/.test(text[index]) ||
    (/[.,;:!?]/.test(text[index]) && /\s/.test(text[index + 1] ?? ""))
  );
}

export interface ExcerptOptions {
  ellipsis?: string;
  /**
   * Move each cut edge inward to the nearest clause end, when one lies in
   * the outer half of that side's room, so a long excerpt of Chinese prose
   * does not start or stop inside a word (the defect `compactText` exists
   * for). Off for titles, which have few clauses and little room.
   */
  clauseBoundaries?: boolean;
}

/**
 * Shorten `text` to `maxLength` (ellipses included) so the hits of `terms`
 * stay visible: the window covers the first hit and as many later ones as
 * fit, with the remaining room split evenly before and after, and an
 * ellipsis on each side that was cut. In spaced text a cut backs off to a
 * word boundary rather than showing half a word, but never into a hit.
 * Without any hit it falls back to the head of the text.
 */
export function excerptAroundTerms(
  text: string,
  terms: string[],
  maxLength = originalTitleMaxLength,
  { ellipsis = "…", clauseBoundaries = false }: ExcerptOptions = {}
): string {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const ranges = matchRanges(trimmed, terms);
  const length = trimmed.length;
  let budget = Math.max(1, maxLength - ellipsis.length * 2);

  if (ranges.length === 0) {
    ranges.push([0, 0]);
  }

  const spanStart = ranges[0][0];
  let spanEnd = ranges[0][1];

  for (const [, end] of ranges.slice(1)) {
    if (end - spanStart > budget) {
      break;
    }
    spanEnd = end;
  }

  // A single hit longer than the whole budget: show it, cut at the end.
  if (spanEnd - spanStart > budget) {
    spanEnd = spanStart + budget;
  }

  const room = budget - (spanEnd - spanStart);
  let start = spanStart - Math.floor(room / 2);
  let end = spanEnd + Math.ceil(room / 2);

  // Pinned to one edge: that side needs no ellipsis, so its room goes to
  // the other side.
  if (start <= 0) {
    budget += ellipsis.length;
    start = 0;
    end = Math.min(length, budget);
  } else if (end >= length) {
    budget += ellipsis.length;
    end = length;
    start = Math.max(0, length - budget);
  }

  if (start > 0 && isLowSurrogate(trimmed.charCodeAt(start))) {
    start += 1;
  }
  if (end < length && isHighSurrogate(trimmed.charCodeAt(end - 1))) {
    end -= 1;
  }

  // Back off to a space when the cut lands inside a word.
  if (
    start > 0 &&
    latinWordCharacter.test(trimmed[start - 1]) &&
    latinWordCharacter.test(trimmed[start])
  ) {
    const space = trimmed.indexOf(" ", start);

    if (space !== -1 && space < spanStart) {
      start = space + 1;
    }
  }
  if (
    end < length &&
    latinWordCharacter.test(trimmed[end - 1]) &&
    latinWordCharacter.test(trimmed[end])
  ) {
    const space = trimmed.lastIndexOf(" ", end - 1);

    if (space !== -1 && space >= spanEnd) {
      end = space;
    }
  }

  if (clauseBoundaries && start > 0) {
    const limit = start + Math.floor((spanStart - start) / 2);

    for (let index = start - 1; index < limit; index += 1) {
      if (isClauseEnd(trimmed, index)) {
        start = index + 1;
        break;
      }
    }
  }
  if (clauseBoundaries && end < length) {
    const limit = end - Math.floor((end - spanEnd) / 2);

    for (let index = end; index >= limit; index -= 1) {
      if (isClauseEnd(trimmed, index)) {
        end = index;
        break;
      }
    }
  }

  const core = trimmed.slice(start, end).replace(edgePunctuation, "");

  return `${start > 0 ? ellipsis : ""}${core}${end < length ? ellipsis : ""}`;
}

/**
 * The excerpt to show under a keyword-matched card's title, or `undefined`
 * when every term already has a visible hit on the card.
 */
export function getOriginalTitleExcerpt(
  card: OriginalTitleCardText,
  terms: string[],
  maxLength = originalTitleMaxLength
): string | undefined {
  const hidden = findHiddenTitleTerms(card, terms);

  if (hidden.length === 0 || !card.originalTitle) {
    return undefined;
  }

  return excerptAroundTerms(card.originalTitle, hidden, maxLength);
}
