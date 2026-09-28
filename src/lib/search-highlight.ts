/**
 * Split a piece of displayed text into plain and matched segments, so the
 * search page can wrap every literal hit of the query in `<mark>`.
 *
 * Matching follows keyword search exactly (`src/lib/search.ts`): each term is
 * compared case-insensitively as a plain substring — no regex, so `c++` or
 * `(` are just characters. Overlapping or touching hits merge into one
 * segment, so `agent` + `age` never produce nested or split marks.
 */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

interface LoweredText {
  lowered: string;
  /** For each UTF-16 index of `lowered`, the matching index in the source. */
  sourceStart: number[];
  /** For each UTF-16 index of `lowered`, where its source character ends. */
  sourceEnd: number[];
}

/**
 * Lower-case character by character and keep a position map, because
 * `toLowerCase` can change length (`İ` becomes two code units), which would
 * shift every offset after it if the lowered string were indexed directly.
 */
function lowerWithPositions(text: string): LoweredText {
  let lowered = "";
  const sourceStart: number[] = [];
  const sourceEnd: number[] = [];
  let index = 0;

  for (const character of text) {
    const lower = character.toLowerCase();
    const end = index + character.length;

    for (let offset = 0; offset < lower.length; offset += 1) {
      sourceStart.push(index);
      sourceEnd.push(end);
    }

    lowered += lower;
    index = end;
  }

  return { lowered, sourceStart, sourceEnd };
}

function normalizeTerms(terms: string[]): string[] {
  const unique = new Set(
    terms.map((term) => term.trim().toLowerCase()).filter(Boolean)
  );

  return [...unique];
}

export function highlightSearchTerms(
  text: string,
  terms: string[]
): HighlightSegment[] {
  if (!text) {
    return [];
  }

  const normalizedTerms = normalizeTerms(terms);

  if (normalizedTerms.length === 0) {
    return [{ text, match: false }];
  }

  const { lowered, sourceStart, sourceEnd } = lowerWithPositions(text);
  const ranges: Array<[number, number]> = [];

  for (const term of normalizedTerms) {
    let from = lowered.indexOf(term);

    while (from !== -1) {
      ranges.push([sourceStart[from], sourceEnd[from + term.length - 1]]);
      from = lowered.indexOf(term, from + 1);
    }
  }

  if (ranges.length === 0) {
    return [{ text, match: false }];
  }

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: Array<[number, number]> = [];

  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];

    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}
