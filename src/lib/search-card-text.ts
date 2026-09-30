import {
  excerptAroundTerms,
  getOriginalTitleExcerpt,
  originalTitleMaxLength
} from "@/lib/search-original-title";

/**
 * What a keyword-matched search card shows under its title (2026-09-30).
 *
 * Keyword search matches a signal's title and summary in both languages and
 * the whole summary, but a card shows the preferred language only, with the
 * summary cut at 160 characters. The 原标题 line already covered a hit in the
 * undisplayed title; this covers the two remaining places a hit could hide:
 *
 * - **past the cut** — the summary is shown as an excerpt around the hit
 *   instead of from its head. Summaries run only a little past the limit
 *   (59 of 92 signals, mostly 165–195 characters), so the moved window drops
 *   a clause from the front, where a second line would repeat most of the
 *   summary the card already shows;
 * - **in the other language's summary** — a 原文摘要 line, excerpted around
 *   the hit like the 原标题 line, and only for terms no other visible text
 *   (title, summary, tags, 原标题) explains.
 *
 * Results found by meaning alone pass no terms and get neither.
 */

/** Where the card cuts a summary; `src/lib/search.ts` truncates with it. */
export const searchSummaryMaxLength = 160;

/** The 原文摘要 excerpt is the length of the 原标题 one. */
export const originalSummaryMaxLength = originalTitleMaxLength;

export interface SearchCardSource {
  title: string;
  /** The summary as cut for the card. */
  summary?: string;
  /** The whole summary; present only when `summary` is cut. */
  fullSummary?: string;
  tags: string[];
  /** The title in the language the card does not show. */
  originalTitle?: string;
  /** The summary in the language the card does not show. */
  originalSummary?: string;
}

export interface SearchCardText {
  /** The summary to display: its head, or an excerpt around a later hit. */
  summary?: string;
  /** The 原标题 excerpt, when a term hits only the undisplayed title. */
  originalTitle?: string;
  /** The 原文摘要 excerpt, when a term hits only the undisplayed summary. */
  originalSummary?: string;
}

function normalizeTerms(terms: string[]): string[] {
  return [
    ...new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean))
  ];
}

function containsTerm(text: string | undefined, term: string): boolean {
  return Boolean(text) && (text as string).toLowerCase().includes(term);
}

function countVisible(text: string | undefined, terms: string[]): number {
  return terms.filter((term) => containsTerm(text, term)).length;
}

/**
 * The summary to show: the head as cut, unless a term the card shows
 * nowhere else hits only past the cut. Then an excerpt around the hits —
 * first around every term the summary has to show, then around the ones
 * the head lost — and whichever shows the most of those terms wins, the
 * head winning a tie.
 */
export function chooseSummaryExcerpt(
  card: SearchCardSource,
  terms: string[],
  maxLength = searchSummaryMaxLength
): string | undefined {
  const { summary: head, fullSummary } = card;
  const normalized = normalizeTerms(terms);

  if (!fullSummary || normalized.length === 0) {
    return head;
  }

  const needed = normalized.filter(
    (term) =>
      containsTerm(fullSummary, term) &&
      !containsTerm(card.title, term) &&
      !card.tags.some((tag) => containsTerm(tag, term))
  );
  const lost = needed.filter((term) => !containsTerm(head, term));

  if (lost.length === 0) {
    return head;
  }

  const options = { clauseBoundaries: true };
  const candidates = [
    excerptAroundTerms(fullSummary, needed, maxLength, options),
    excerptAroundTerms(fullSummary, lost, maxLength, options)
  ];
  let best = head;
  let bestCount = countVisible(head, needed);

  for (const candidate of candidates) {
    const count = countVisible(candidate, needed);

    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/**
 * The terms that hit the undisplayed summary and nothing the card shows,
 * the 原标题 line included. Judged per term, like the 原标题 line.
 */
export function findHiddenSummaryTerms(
  visible: {
    title: string;
    summary?: string;
    tags: string[];
    originalTitle?: string;
  },
  originalSummary: string | undefined,
  terms: string[]
): string[] {
  if (!originalSummary) {
    return [];
  }

  return normalizeTerms(terms).filter(
    (term) =>
      containsTerm(originalSummary, term) &&
      !containsTerm(visible.title, term) &&
      !containsTerm(visible.summary, term) &&
      !containsTerm(visible.originalTitle, term) &&
      !visible.tags.some((tag) => containsTerm(tag, term))
  );
}

export function getSearchCardText(
  card: SearchCardSource,
  terms: string[]
): SearchCardText {
  const summary = chooseSummaryExcerpt(card, terms);
  // Judged against the summary the card actually shows.
  const originalTitle = getOriginalTitleExcerpt({ ...card, summary }, terms);
  const hiddenInSummary = findHiddenSummaryTerms(
    { title: card.title, summary, tags: card.tags, originalTitle },
    card.originalSummary,
    terms
  );

  return {
    summary,
    originalTitle,
    originalSummary:
      hiddenInSummary.length > 0 && card.originalSummary
        ? excerptAroundTerms(
            card.originalSummary,
            hiddenInSummary,
            originalSummaryMaxLength
          )
        : undefined
  };
}
