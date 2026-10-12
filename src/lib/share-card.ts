import type { TopicHubData } from "@/lib/topic-hub";
import type { WeeklyReviewData } from "@/lib/weekly-review";
import type { KnowledgeItem, SkillItem, TechnologyItem } from "@/types/content";

import {
  difficultyLabels,
  heatLabels,
  knowledgeCategoryLabels,
  learningCostLabels,
  skillTypeLabels
} from "@/lib/content-labels";
import { siteDescription, siteName } from "@/lib/site-metadata";
import {
  getPreferredTechnologyTitle,
  getPublisherTypeLabel,
  getTechnologyTypeLabel
} from "@/lib/technology-localization";

/**
 * What the 1200×630 share card for a public detail page says, and how its
 * title is broken into lines. One layout serves every kind — signal, digest,
 * weekly review, skill, knowledge, topic — and the site card they all fall
 * back to; `src/lib/share-card-image.tsx` paints it. Kept free of JSX and
 * fonts so the choices — which public fields appear, where a long title
 * wraps, when it is cut — are testable.
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

export type ShareCardKind =
  | "signal"
  | "digest"
  | "weekly"
  | "skill"
  | "knowledge"
  | "topic"
  | "radar"
  | "site";

export interface ShareCard {
  kind: ShareCardKind;
  siteName: string;
  /** Short stamp in the top-right corner, e.g. 技术信号 · 模型. */
  stamp: string;
  title: ShareCardTitleLayout;
  /** One line under the title: source and publisher type, counts, or the tagline. */
  byline: string;
  /**
   * Right end of the byline row: a signal's publish date, a digest's issue
   * date, a weekly review's year. Absent on the other cards, which gives the
   * byline the full width.
   */
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

function isPunctuation(char: string): boolean {
  return closingPunctuation.has(char) || openingPunctuation.has(char);
}

/**
 * Joins the last break unit to the one before it (and the space between
 * them, if any) when the last one holds a single character, punctuation
 * aside — 理, 定。 — so it can never end up alone on the title's last line.
 *
 * Greedy filling only puts the two on different lines when the last one
 * would otherwise be that orphan, so a title that had none lays out exactly
 * as before; with one, the character before it moves down to keep it
 * company. The caller must not use the result when the joined unit is wider
 * than a line, since that would break it character by character.
 */
export function bindTrailingUnit(units: string[]): string[] {
  const last = units.length - 1;

  if (last < 1) {
    return units;
  }

  const letters = Array.from(units[last]).filter(
    (char) => !isPunctuation(char)
  );

  if (letters.length > 1) {
    return units;
  }

  const previous = units[last - 1] === " " ? last - 2 : last - 1;

  if (previous < 0) {
    return units;
  }

  return [...units.slice(0, previous), units.slice(previous).join("")];
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
  const bound = bindTrailingUnit(units);

  for (const step of titleSteps) {
    const maxEm = widthPx / step.fontSize;
    const lines = wrapUnits(
      estimateTextWidth(bound[bound.length - 1] ?? "") <= maxEm ? bound : units,
      maxEm
    );

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

/** The byline, cut to the width the date (when there is one) leaves it. */
function fitByline(text: string, hasDate: boolean): string {
  const width = hasDate
    ? shareCardTitleWidth - shareCardDateReserve
    : shareCardTitleWidth;

  return fitSingleLine(text, width / shareCardBylineFontSize);
}

/**
 * The generic card every builder falls back to when its page would 404: an
 * unknown slug, an unpublished record, a topic with nothing published. A
 * share image must never name something the page itself would not show.
 */
export function buildSiteShareCard(): ShareCard {
  return {
    kind: "site",
    siteName,
    stamp: "技术雷达",
    title: layoutShareCardTitle(siteDescription),
    byline: "技术信号 · 技能 · 背景知识"
  };
}

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
    return buildSiteShareCard();
  }

  const typeLabel = getTechnologyTypeLabel(technology.type, "zh");
  const publisherLabel = getPublisherTypeLabel(technology.publisherType, "zh");
  const source = technology.sourceName.trim() || technology.publisherName;

  return {
    kind: "signal",
    siteName,
    stamp: `技术信号 · ${typeLabel}`,
    title: layoutShareCardTitle(getPreferredTechnologyTitle(technology)),
    byline: fitByline(`来源 ${source} · ${publisherLabel}`, true),
    date: technology.publishDate
  };
}

const sentenceEnds = new Set("。！？!?".split(""));
const sentenceClosers = new Set("”’」』）)".split(""));

/**
 * The text up to and including the first 。！？ (with any closing quote
 * after it). An ASCII full stop does not end a sentence here: it is far
 * more often a version number or a decimal — v0.26.0, 3.7 倍.
 */
export function firstSentence(text: string): string {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  let end = chars.findIndex((char) => sentenceEnds.has(char));

  if (end === -1) {
    return chars.join("");
  }

  while (end + 1 < chars.length && sentenceClosers.has(chars[end + 1])) {
    end += 1;
  }

  return chars.slice(0, end + 1).join("");
}

/**
 * What a digest card needs, all of it already on the public digest page:
 * the public title (after `getPublicDigestTitle`), the first sentence of
 * the editorial summary when there is one (the page's 今日概览), the issue
 * date, and the two section counts the hero's meta row shows.
 */
export interface DigestShareCardInput {
  date: string;
  title: string;
  lede?: string;
  highPriorityCount: number;
  watchCount: number;
}

/**
 * A published digest, or the site card when there is none to show. The
 * card's headline is the editorial summary's first sentence, not the title:
 * every published title is the generated `技术简报 - <date>`, which would
 * repeat the stamp and the date printed beside it. A digest without an
 * editorial summary keeps its title.
 *
 * The summary is new free text every issue, so it can use a character the
 * font subset lacks. next/og would then fetch a stand-in from Google Fonts —
 * a light sans among bold serif, a box when even that fails, and 16s for the
 * first render in a 2026-09-29 test, past a link-preview crawler's patience.
 * `canDraw` lets the caller veto such a sentence; the title (fixed words
 * and a date) is then used instead.
 */
export function buildDigestShareCard(
  digest: DigestShareCardInput | undefined,
  { canDraw = () => true }: { canDraw?: (text: string) => boolean } = {}
): ShareCard {
  if (!digest) {
    return buildSiteShareCard();
  }

  const sentence = digest.lede ? firstSentence(digest.lede) : "";
  const lede = sentence && canDraw(sentence) ? sentence : "";

  return {
    kind: "digest",
    siteName,
    stamp: "技术简报",
    title: layoutShareCardTitle(lede || digest.title),
    byline: fitByline(
      `${digest.highPriorityCount} 条立即关注 · ${digest.watchCount} 条值得跟踪`,
      true
    ),
    date: digest.date
  };
}

/**
 * A week of the weekly review, or the site card for a week the page would
 * 404 on (no such week, or none of its signals shown). The range label
 * carries no year, so the year sits where the other cards put their date.
 */
export function buildWeeklyShareCard(
  week: WeeklyReviewData | undefined
): ShareCard {
  if (!week || week.totalCount === 0) {
    return buildSiteShareCard();
  }

  return {
    kind: "weekly",
    siteName,
    stamp: "本周回顾",
    title: layoutShareCardTitle(week.rangeLabel),
    byline: fitByline(
      `${week.totalCount} 条信号 · ${week.highPriorityCount} 条立即关注 · ${week.watchCount} 条值得跟踪 · ${week.topicCount} 个话题`,
      true
    ),
    date: `${week.weekStart.slice(0, 4)} 年`
  };
}

/**
 * A published skill: its type in the stamp, and heat and learning cost —
 * the two chips on the skill page's hero — as the byline.
 */
export function buildSkillShareCard(skill: SkillItem | undefined): ShareCard {
  if (!skill) {
    return buildSiteShareCard();
  }

  return {
    kind: "skill",
    siteName,
    stamp: `技能 · ${skillTypeLabels[skill.skillType]}`,
    title: layoutShareCardTitle(skill.title),
    byline: fitByline(
      `${heatLabels[skill.heatLevel]} · ${learningCostLabels[skill.learningCost]}`,
      false
    )
  };
}

/** A published knowledge item: category in the stamp, difficulty below. */
export function buildKnowledgeShareCard(
  knowledge: KnowledgeItem | undefined
): ShareCard {
  if (!knowledge) {
    return buildSiteShareCard();
  }

  return {
    kind: "knowledge",
    siteName,
    stamp: `知识 · ${knowledgeCategoryLabels[knowledge.category]}`,
    title: layoutShareCardTitle(knowledge.title),
    byline: fitByline(`难度 ${difficultyLabels[knowledge.difficulty]}`, false)
  };
}

/**
 * A topic hub, with the same three counts the /topics index prints for it.
 * `getTopicHub` already returns nothing for an unknown or empty topic.
 */
export function buildTopicShareCard(hub: TopicHubData | undefined): ShareCard {
  if (!hub) {
    return buildSiteShareCard();
  }

  return {
    kind: "topic",
    siteName,
    stamp: "话题",
    title: layoutShareCardTitle(hub.tag.name),
    byline: fitByline(
      `收录 ${hub.technologies.length} 信号 · ${hub.skills.length} 技能 · ${hub.knowledge.length} 知识`,
      false
    )
  };
}

export interface RadarShareCardInput {
  entryCount: number;
  /** Entries per ring, innermost first: 采用, 试用, 评估, 暂缓. */
  ringCounts: readonly number[];
  /** The newest change on the radar, YYYY-MM-DD. */
  latestDate: string;
}

/**
 * The /radar page: its title, the ring counts the page prints, and the date
 * of its newest change. An empty radar gets the site card, as the page
 * itself shows nothing to point at.
 */
export function buildRadarShareCard(input: RadarShareCardInput): ShareCard {
  if (input.entryCount === 0) {
    return buildSiteShareCard();
  }

  const [adopt = 0, trial = 0, assess = 0, hold = 0] = input.ringCounts;

  return {
    kind: "radar",
    siteName,
    stamp: "技术雷达",
    title: layoutShareCardTitle(
      `技术雷达：${input.entryCount} 项技术放在哪一环`
    ),
    byline: fitByline(
      `采用 ${adopt} · 试用 ${trial} · 评估 ${assess} · 暂缓 ${hold}`,
      true
    ),
    date: input.latestDate
  };
}
