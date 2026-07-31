/**
 * Shortens a summary to fit a card without cutting inside a word.
 *
 * Both public surfaces that shorten text — the digest cards and the news fast
 * lane — used to slice at a raw character index and append an ellipsis. In
 * English that lands between words often enough to go unnoticed; in Chinese,
 * which has no spaces, it lands wherever the count runs out. The digest was
 * shipping `…意图路由、策略检查、PII 识别、文本分类，这些任...`, with 任务 split
 * down the middle.
 *
 * The cut therefore backs off, in order:
 *
 * 1. to the last clause boundary (、，。；：！？ and their latin equivalents),
 *    so the text ends between phrases the way a reader would stop;
 * 2. failing that — a long run with no punctuation — to the last word boundary
 *    `Intl.Segmenter` reports, the same mechanism `cjk-line-break.ts` uses;
 * 3. failing that, to the raw index, which is what the old code always did.
 *
 * A boundary is only accepted when it keeps most of the budget: backing off
 * from 187 characters to 40 to land on a comma would lose more than the ragged
 * edge was worth.
 */

const clauseBoundary = /[。！？；，、：,;:.!?]/;
const trailingSeparators = /[\s。！？；，、：,;:.!?·—\-–—]+$/;

/** Keep at least this share of the budget when backing off to a boundary. */
const minimumKeptShare = 0.6;

/**
 * A latin `.` or `,` between two digits is a decimal point or a thousands
 * separator, not a clause ending — cutting there turns `Apache 2.0` into
 * `Apache 2`, which is the same "cut inside a token" defect one level down.
 */
function isInsideNumber(text: string, index: number): boolean {
  return (
    /[.,]/.test(text[index]) &&
    /\d/.test(text[index - 1] ?? "") &&
    /\d/.test(text[index + 1] ?? "")
  );
}

function lastClauseBoundaryAtOrBefore(text: string, limit: number): number {
  for (let index = Math.min(limit, text.length) - 1; index >= 0; index -= 1) {
    if (clauseBoundary.test(text[index]) && !isInsideNumber(text, index)) {
      return index + 1;
    }
  }

  return -1;
}

function lastWordBoundaryAtOrBefore(text: string, limit: number): number {
  const segmenter = Intl.Segmenter;

  if (!segmenter) {
    return -1;
  }

  // Segment a little past the limit so a word ending exactly on it is still
  // reported as a boundary rather than looking like a truncated word.
  const window = text.slice(0, Math.min(text.length, limit + 12));
  let best = -1;

  for (const segment of new segmenter("zh-CN", {
    granularity: "word"
  }).segment(window)) {
    if (segment.index > 0 && segment.index <= limit && segment.index > best) {
      best = segment.index;
    }
  }

  return best;
}

/**
 * @param maxLength maximum length of the returned string, ellipsis included.
 */
export function compactText(
  value: string,
  maxLength: number,
  ellipsis = "…"
): string {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const budget = Math.max(0, maxLength - ellipsis.length);

  if (budget === 0) {
    return ellipsis;
  }

  const floor = Math.floor(budget * minimumKeptShare);
  let cut = lastClauseBoundaryAtOrBefore(trimmed, budget);

  if (cut < floor) {
    cut = lastWordBoundaryAtOrBefore(trimmed, budget);
  }

  if (cut < floor) {
    cut = budget;
  }

  const head = trimmed.slice(0, cut).replace(trailingSeparators, "");

  return `${head || trimmed.slice(0, budget).trimEnd()}${ellipsis}`;
}
