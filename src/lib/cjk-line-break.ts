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
  /** True when the run must stay on one line: a word, a `YYYY-MM-DD` date, a name with its version. */
  keepTogether: boolean;
}

const datePattern = /\d{4}-\d{2}-\d{2}/g;

/**
 * A name and its version number stay on one line: `Memento 3`, `Gemini 3.8`,
 * `MCP 2.0`, and a hyphenated name carrying a number, `ARC-AGI-3`,
 * `V4.1-Flash-1017`, `o3-mini`. Measured 2026-10-21: the 375px signal page
 * put `Memento` and `3` on two lines, and list cards ended on `ARC-AGI- / 3`.
 * A hyphenated name with no digit (`Claude-Code`) is left to the browser.
 */
const versionPattern =
  /[A-Za-z][A-Za-z0-9.]* \d+(?:\.\d+)*(?![\d.])|(?=[A-Za-z0-9.-]*\d)[A-Za-z0-9.]+(?:-[A-Za-z0-9.]+)+/g;

const protectedPatterns = [datePattern, versionPattern];

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

  // Dates and version numbers first: their hyphens and spaces are break
  // opportunities that segmentation would not protect.
  let lastIndex = 0;
  const found: { start: number; end: number }[] = [];
  for (const pattern of protectedPatterns) {
    for (const match of title.matchAll(pattern)) {
      if (match.index === undefined) continue;
      found.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  // Earliest first; a range inside one already taken (a date is also a
  // hyphenated token with digits) is dropped rather than split.
  const dateRanges = found
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce<{ start: number; end: number }[]>((kept, range) => {
      const previous = kept[kept.length - 1];
      if (!previous || range.start >= previous.end) kept.push(range);
      return kept;
    }, []);

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
