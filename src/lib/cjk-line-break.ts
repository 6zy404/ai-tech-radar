/**
 * Splits a heading into runs that must not be broken across lines.
 *
 * Chinese has no spaces, so the default line-breaking rule allows a break
 * between any two han characters — `旗舰` renders as `…参数旗` / `舰，…`. The
 * CSS feature meant to solve this (`word-break: auto-phrase`) was measured in
 * Chrome 148 and changes Japanese line breaks but leaves Chinese untouched,
 * so the segmentation has to happen here.
 *
 * `Intl.Segmenter` runs on the server too, so callers can use this from server
 * components without rewriting the heading after hydration.
 *
 * Known limitation, measured rather than assumed: the ICU dictionary keeps
 * `旗舰` / `关注` / `参数` / `承诺` together but still splits `权重`,
 * `智能体`, `轻量` and `付费`. This reduces mid-word breaks; it does not
 * eliminate them.
 */
export interface UnbreakableRun {
  text: string;
  /** True when the run must stay on one line (a word, or a `YYYY-MM-DD` date). */
  keepTogether: boolean;
}

const datePattern = /\d{4}-\d{2}-\d{2}/g;

function hasCjk(value: string): boolean {
  return /[㐀-鿿豈-﫿]/.test(value);
}

/**
 * A run is worth wrapping only if breaking inside it would be wrong *and*
 * breaking is possible: single characters and runs without CJK (latin words
 * already break on spaces) are left as plain text so the markup stays small.
 */
function isWorthKeepingTogether(value: string): boolean {
  return value.length > 1 && hasCjk(value);
}

export function splitIntoUnbreakableRuns(title: string): UnbreakableRun[] {
  const runs: UnbreakableRun[] = [];

  // Dates first: their hyphens are break opportunities that segmentation
  // would not protect.
  let lastIndex = 0;
  const dateRanges: { start: number; end: number }[] = [];
  for (const match of title.matchAll(datePattern)) {
    if (match.index === undefined) continue;
    dateRanges.push({ start: match.index, end: match.index + match[0].length });
  }

  const pushSegmented = (chunk: string) => {
    if (!chunk) return;

    if (typeof Intl.Segmenter !== "function" || !hasCjk(chunk)) {
      runs.push({ text: chunk, keepTogether: false });
      return;
    }

    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
    for (const segment of segmenter.segment(chunk)) {
      runs.push({
        text: segment.segment,
        keepTogether:
          Boolean(segment.isWordLike) && isWorthKeepingTogether(segment.segment)
      });
    }
  };

  for (const range of dateRanges) {
    pushSegmented(title.slice(lastIndex, range.start));
    runs.push({
      text: title.slice(range.start, range.end),
      keepTogether: true
    });
    lastIndex = range.end;
  }
  pushSegmented(title.slice(lastIndex));

  // Merge neighbouring breakable runs so the rendered markup stays compact.
  return runs.reduce<UnbreakableRun[]>((merged, run) => {
    const previous = merged[merged.length - 1];

    if (previous && !previous.keepTogether && !run.keepTogether) {
      previous.text += run.text;
      return merged;
    }

    merged.push({ ...run });
    return merged;
  }, []);
}
