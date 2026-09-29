import type { TechnologyItem } from "@/types/content";

import { siteDescription, siteName } from "@/lib/site-metadata";
import {
  getPreferredTechnologyTitle,
  getPublisherTypeLabel,
  getTechnologyTypeLabel
} from "@/lib/technology-localization";

/**
 * What the 1200×630 share card for a signal page says, and how its title is
 * broken into lines. Kept free of JSX and fonts so the choices — which public
 * fields appear, where a long title wraps, when it is cut — are testable.
 *
 * Satori (behind `next/og`) wraps text itself but cannot clamp to a number of
 * lines, so a long title would run off the card. The title is therefore laid
 * out here, with glyph widths estimated on the generous side: a line that
 * comes out a little short is harmless, one that comes out long is clipped.
 */

export const shareCardSize = { width: 1200, height: 630 } as const;

/** Width available to the title, in px: the card minus both paddings. */
export const shareCardTitleWidth = 1000;

/** Font sizes tried largest first, each with the most lines it may use. */
const titleSteps = [
  { fontSize: 68, maxLines: 2 },
  { fontSize: 60, maxLines: 3 },
  { fontSize: 52, maxLines: 4 }
] as const;

export interface ShareCardTitleLayout {
  fontSize: number;
  lines: string[];
  truncated: boolean;
}

export interface ShareCard {
  kind: "signal" | "site";
  siteName: string;
  /** Short stamp in the top-right corner, e.g. 技术信号 · 模型. */
  stamp: string;
  title: ShareCardTitleLayout;
  /** One line under the title: source and publisher type, or the tagline. */
  byline: string;
  /** Publish date for a signal; absent on the site card. */
  date?: string;
}

const closingPunctuation = new Set(
  "，。、；：？！）》」』】〉”’…,.;:!?)]}%".split("")
);
const openingPunctuation = new Set("（《「『【〈“‘([{".split(""));

function isWide(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;

  return (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0x3000 && code <= 0x303f) ||
    code === 0x2026 ||
    code === 0x2014
  );
}

/**
 * Estimated advance of one character in em, for a bold serif. Deliberately
 * on the wide side for Latin, which varies more than CJK does.
 */
export function estimateCharWidth(char: string): number {
  if (isWide(char)) {
    return 1;
  }

  if (char === " ") {
    return 0.3;
  }

  if ("MW@%".includes(char)) {
    return 0.98;
  }

  if ("mw".includes(char)) {
    return 0.86;
  }

  if ("ijlI.,:;!|'`".includes(char)) {
    return 0.34;
  }

  if (/[A-Z]/.test(char)) {
    return 0.78;
  }

  if (/[0-9a-z]/.test(char)) {
    return 0.64;
  }

  return 0.66;
}

export function estimateTextWidth(text: string): number {
  let width = 0;

  for (const char of text) {
    width += estimateCharWidth(char);
  }

  return width;
}

/**
 * Splits text into the pieces a line may break between: every CJK character
 * on its own, a Latin word as one piece, a space as its own piece. Closing
 * punctuation sticks to the piece before it and opening punctuation to the
 * piece after, so neither can start or end a line on the wrong side.
 */
export function splitIntoBreakUnits(text: string): string[] {
  const units: string[] = [];
  let word = "";
  let pendingOpen = "";

  const pushUnit = (unit: string) => {
    units.push(pendingOpen + unit);
    pendingOpen = "";
  };
  const flushWord = () => {
    if (word) {
      pushUnit(word);
      word = "";
    }
  };

  for (const char of text) {
    if (char === " ") {
      flushWord();
      if (!pendingOpen && units.length > 0 && units[units.length - 1] !== " ") {
        units.push(" ");
      }
      continue;
    }

    if (closingPunctuation.has(char) && word) {
      word += char;
      continue;
    }

    if (closingPunctuation.has(char) && units.length > 0) {
      const lastIndex =
        units[units.length - 1] === " " ? units.length - 2 : units.length - 1;

      if (lastIndex >= 0) {
        units.splice(lastIndex + 1);
        units[lastIndex] += char;
        continue;
      }
    }

    if (openingPunctuation.has(char)) {
      flushWord();
      pendingOpen += char;
      continue;
    }

    if (isWide(char)) {
      flushWord();
      pushUnit(char);
      continue;
    }

    word += char;
  }

  flushWord();

  if (pendingOpen) {
    units.push(pendingOpen);
  }

  while (units[units.length - 1] === " ") {
    units.pop();
  }

  return units;
}

/** Breaks one over-long piece (a URL-like word) character by character. */
function hardSplit(unit: string, maxEm: number): string[] {
  const parts: string[] = [];
  let current = "";

  for (const char of unit) {
    if (current && estimateTextWidth(current + char) > maxEm) {
      parts.push(current);
      current = "";
    }
    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/** Greedy line filling in em units; returns every line, not yet clamped. */
export function wrapUnits(units: string[], maxEm: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const unit of units) {
    if (unit === " ") {
      if (current) {
        current += " ";
      }
      continue;
    }

    if (estimateTextWidth(current + unit) <= maxEm) {
      current += unit;
      continue;
    }

    if (current.trim()) {
      lines.push(current.trimEnd());
    }
    current = "";

    if (estimateTextWidth(unit) <= maxEm) {
      current = unit;
      continue;
    }

    const parts = hardSplit(unit, maxEm);
    lines.push(...parts.slice(0, -1));
    current = parts[parts.length - 1] ?? "";
  }

  if (current.trim()) {
    lines.push(current.trimEnd());
  }

  return lines;
}

/** Shortens a line until it and a trailing ellipsis fit. */
export function withEllipsis(line: string, maxEm: number): string {
  const chars = Array.from(line.trimEnd());

  while (chars.length > 0 && estimateTextWidth(chars.join("") + "…") > maxEm) {
    chars.pop();
  }

  // Do not leave a dangling space or punctuation before the ellipsis.
  while (
    chars.length > 0 &&
    (chars[chars.length - 1] === " " ||
      closingPunctuation.has(chars[chars.length - 1]) ||
      openingPunctuation.has(chars[chars.length - 1]))
  ) {
    chars.pop();
  }

  return `${chars.join("")}…`;
}

/**
 * Picks the largest step at which the whole title fits; when none does, the
 * smallest step is used and its last line ends in an ellipsis.
 */
export function layoutShareCardTitle(
  rawTitle: string,
  widthPx = shareCardTitleWidth
): ShareCardTitleLayout {
  const title = rawTitle.replace(/\s+/g, " ").trim();
  const units = splitIntoBreakUnits(title);

  for (const step of titleSteps) {
    const lines = wrapUnits(units, widthPx / step.fontSize);

    if (lines.length <= step.maxLines) {
      return { fontSize: step.fontSize, lines, truncated: false };
    }
  }

  const last = titleSteps[titleSteps.length - 1];
  const maxEm = widthPx / last.fontSize;
  const lines = wrapUnits(units, maxEm).slice(0, last.maxLines);
  lines[lines.length - 1] = withEllipsis(lines[lines.length - 1], maxEm);

  return { fontSize: last.fontSize, lines, truncated: true };
}

/** Cuts a single-line text to a width in em, with an ellipsis if needed. */
export function fitSingleLine(text: string, maxEm: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();

  return estimateTextWidth(collapsed) <= maxEm
    ? collapsed
    : withEllipsis(collapsed, maxEm);
}

/** Byline font size in px. */
export const shareCardBylineFontSize = 28;

/** Room the date takes at the right end of the byline row, gap included. */
const shareCardDateReserve = 230;

/**
 * The card for one published signal, or the generic site card when the slug
 * resolves to nothing. Reads only public `TechnologyItem` fields — the same
 * ones the detail page renders — and deliberately not the priority band: it
 * changes as a signal ages, and a platform caches a share image for weeks.
 */
export function buildShareCard(
  technology: TechnologyItem | undefined
): ShareCard {
  if (!technology) {
    return {
      kind: "site",
      siteName,
      stamp: "技术雷达",
      title: layoutShareCardTitle(siteDescription),
      byline: "技术信号 · 技能 · 背景知识"
    };
  }

  const typeLabel = getTechnologyTypeLabel(technology.type, "zh");
  const publisherLabel = getPublisherTypeLabel(technology.publisherType, "zh");
  const source = technology.sourceName.trim() || technology.publisherName;

  return {
    kind: "signal",
    siteName,
    stamp: `技术信号 · ${typeLabel}`,
    title: layoutShareCardTitle(getPreferredTechnologyTitle(technology)),
    byline: fitSingleLine(
      `来源 ${source} · ${publisherLabel}`,
      (shareCardTitleWidth - shareCardDateReserve) / shareCardBylineFontSize
    ),
    date: technology.publishDate
  };
}
