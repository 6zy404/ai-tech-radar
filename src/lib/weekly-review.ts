import { getAllTechnologies } from "@/lib/content";
import { getTodayDateString } from "@/lib/digest-store";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type { TechnologyItem } from "@/types/content";

/**
 * Weekly review is a pure derived view over published technology signals, a
 * time-boxed sibling of the Daily Digest. Like the digest archive and the
 * content graph, it persists nothing and calls no LLM: it buckets published
 * signals into natural weeks (Monday–Sunday), classifies each with the same
 * deterministic Ranking v0 the rest of the public product uses, and keeps only
 * the immediate-attention (`high_priority`) and worth-tracking (`watch`)
 * levels — `low_priority` is excluded, matching the Daily Digest's default.
 */

/** A shown weekly-review level. `low_priority` is intentionally excluded. */
export type WeeklyReviewLevel = "high_priority" | "watch";

export interface WeeklyReviewSignal {
  slug: string;
  title: string;
  summary: string;
  publishDate: string;
  sourceName: string;
  level: WeeklyReviewLevel;
}

export interface WeeklyReviewGroup {
  level: WeeklyReviewLevel;
  signals: WeeklyReviewSignal[];
}

export interface WeeklyReviewData {
  /** Canonical week key: the Monday date (`YYYY-MM-DD`). */
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  rangeLabel: string;
  isCurrentWeek: boolean;
  totalCount: number;
  highPriorityCount: number;
  watchCount: number;
  topicCount: number;
  groups: WeeklyReviewGroup[];
}

export interface WeeklyReviewArchiveEntry {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  rangeLabel: string;
  highPriorityCount: number;
  watchCount: number;
  totalCount: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | undefined {
  if (!ISO_DATE_PATTERN.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday (week start) for the natural week containing `dateStr`. */
function getWeekStartKey(dateStr: string): string | undefined {
  const date = parseIsoDate(dateStr);

  if (!date) {
    return undefined;
  }

  const weekday = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = (weekday + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysSinceMonday);

  return formatIsoDate(date);
}

function addDays(dateStr: string, days: number): string {
  const date = parseIsoDate(dateStr);

  if (!date) {
    return dateStr;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return formatIsoDate(date);
}

function getWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = parseIsoDate(weekStart);
  const end = parseIsoDate(weekEnd);

  if (!start || !end) {
    return `${weekStart} – ${weekEnd}`;
  }

  const startPart = `${start.getUTCMonth() + 1} 月 ${start.getUTCDate()} 日`;
  const endPart = `${end.getUTCMonth() + 1} 月 ${end.getUTCDate()} 日`;

  return `${startPart} – ${endPart}`;
}

function getShownLevel(item: TechnologyItem): WeeklyReviewLevel | undefined {
  const level = evaluateTechnologyPriority(item).priorityLevel;

  return level === "high_priority" || level === "watch" ? level : undefined;
}

function toSignal(
  item: TechnologyItem,
  level: WeeklyReviewLevel
): WeeklyReviewSignal {
  return {
    slug: item.slug,
    title: getPreferredTechnologyTitle(item),
    summary: getPreferredTechnologySummary(item),
    publishDate: item.publishDate,
    sourceName: item.sourceName,
    level
  };
}

function sortSignals(signals: WeeklyReviewSignal[]): WeeklyReviewSignal[] {
  return [...signals].sort(
    (left, right) =>
      right.publishDate.localeCompare(left.publishDate) ||
      left.title.localeCompare(right.title, "zh-CN")
  );
}

/**
 * The weekly review for one natural week. Pass a canonical Monday `weekKey`
 * for a specific week, or omit it for the current week. Returns `undefined`
 * only for an invalid or non-canonical key (a non-Monday date), so callers can
 * `notFound()`; a valid week with no shown signals still resolves (the page
 * renders an empty state / or 404s on the totalCount, per the caller).
 */
export function getWeeklyReview(
  weekKey?: string
): WeeklyReviewData | undefined {
  const currentWeekKey = getWeekStartKey(getTodayDateString());

  let resolvedWeekKey: string;

  if (weekKey === undefined) {
    if (!currentWeekKey) {
      return undefined;
    }

    resolvedWeekKey = currentWeekKey;
  } else {
    const normalized = getWeekStartKey(weekKey);

    // Require the canonical Monday key so each week has exactly one URL.
    if (!normalized || normalized !== weekKey) {
      return undefined;
    }

    resolvedWeekKey = normalized;
  }

  const weekStart = resolvedWeekKey;
  const weekEnd = addDays(weekStart, 6);

  const highPriority: WeeklyReviewSignal[] = [];
  const watch: WeeklyReviewSignal[] = [];
  const topicIds = new Set<string>();

  for (const item of getAllTechnologies()) {
    if (item.publishDate < weekStart || item.publishDate > weekEnd) {
      continue;
    }

    const level = getShownLevel(item);

    if (!level) {
      continue;
    }

    const signal = toSignal(item, level);

    if (level === "high_priority") {
      highPriority.push(signal);
    } else {
      watch.push(signal);
    }

    for (const tagId of item.tags) {
      topicIds.add(tagId);
    }
  }

  const groups: WeeklyReviewGroup[] = [];

  if (highPriority.length > 0) {
    groups.push({ level: "high_priority", signals: sortSignals(highPriority) });
  }

  if (watch.length > 0) {
    groups.push({ level: "watch", signals: sortSignals(watch) });
  }

  return {
    weekKey: resolvedWeekKey,
    weekStart,
    weekEnd,
    rangeLabel: getWeekRangeLabel(weekStart, weekEnd),
    isCurrentWeek: resolvedWeekKey === currentWeekKey,
    totalCount: highPriority.length + watch.length,
    highPriorityCount: highPriority.length,
    watchCount: watch.length,
    topicCount: topicIds.size,
    groups
  };
}

interface WeeklyReviewArchiveOptions {
  /** Omit this week from the list (e.g. the week already shown above it). */
  excludeWeekKey?: string;
}

/**
 * Every past/other natural week that has at least one shown signal, newest
 * first. Used for the "往期周回顾" list folded into the weekly-review pages.
 */
export function getWeeklyReviewArchive(
  options: WeeklyReviewArchiveOptions = {}
): WeeklyReviewArchiveEntry[] {
  const weeks = new Map<
    string,
    { highPriorityCount: number; watchCount: number }
  >();

  for (const item of getAllTechnologies()) {
    const weekKey = getWeekStartKey(item.publishDate);

    if (!weekKey || weekKey === options.excludeWeekKey) {
      continue;
    }

    const level = getShownLevel(item);

    if (!level) {
      continue;
    }

    const counts = weeks.get(weekKey) ?? {
      highPriorityCount: 0,
      watchCount: 0
    };

    if (level === "high_priority") {
      counts.highPriorityCount += 1;
    } else {
      counts.watchCount += 1;
    }

    weeks.set(weekKey, counts);
  }

  return [...weeks.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([weekKey, counts]) => {
      const weekEnd = addDays(weekKey, 6);

      return {
        weekKey,
        weekStart: weekKey,
        weekEnd,
        rangeLabel: getWeekRangeLabel(weekKey, weekEnd),
        highPriorityCount: counts.highPriorityCount,
        watchCount: counts.watchCount,
        totalCount: counts.highPriorityCount + counts.watchCount
      };
    });
}
