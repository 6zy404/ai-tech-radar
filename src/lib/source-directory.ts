// `/sources` — who the published signals come from, grouped by publisher.
//
// The page is derived from published signals and nothing else. It reads five
// public fields a signal page already shows (publisherName, publisherType,
// sourceName, publishDate, slug) plus the public title, and never the source
// configuration, import runs, source health, feed URLs or the import pool: those
// live in the workspace, and a directory built from them would publish which
// feeds the site polls and how well each one is doing.
//
// The group key is publisherName, not sourceName. publisherName is the
// organisation behind the announcement; sourceName is only the feed it came
// through — OpenAI's signals arrive via OpenAI News, 量子位 and Simon
// Willison's blog alike, and one reader-facing "OpenAI" is what they share.

import {
  getPreferredTechnologyTitle,
  getPublisherTypeLabel
} from "@/lib/technology-localization";
import type { PublisherType, TechnologyItem } from "@/types/content";

/** One of the publisher's published signals, as the card lists it. */
export interface SourceDirectorySignal {
  title: string;
  slug: string;
  publishDate: string;
}

/** One publisher. These six fields are all that leaves this module. */
export interface SourceDirectoryEntry {
  publisherName: string;
  publisherType: PublisherType;
  publisherTypeLabel: string;
  signalCount: number;
  /**
   * Its newest signals, newest first: at most `recentSignalLimit`, and only
   * as many as it has — a one-signal publisher gets a list of one.
   */
  recent: SourceDirectorySignal[];
  /** The feeds its signals came through, most-used first. */
  sourceNames: string[];
}

export interface SourceDirectory {
  /** Most signals first, then by name. */
  entries: SourceDirectoryEntry[];
  totals: {
    publishers: number;
    signals: number;
    sources: number;
    /** Signals with an empty publisherName, grouped under their sourceName. */
    publisherNameFallbacks: number;
  };
}

export interface SourceDirectorySection {
  publisherType: PublisherType;
  label: string;
  signalCount: number;
  entries: SourceDirectoryEntry[];
}

/** How many signals a card lists. */
export const recentSignalLimit = 3;

// Tie order for sections with the same signal count.
const publisherTypeOrder: PublisherType[] = [
  "big-tech",
  "startup",
  "research-lab",
  "open-source-community",
  "media"
];

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, "zh-CN");
}

// The slug, so a card, its #publisher-… anchor and /technologies?publisher=…
// are one-to-one: two spellings that slug alike ("Hugging Face", "hugging
// face") are one publisher. A name with no letters or digits keeps its own key.
function groupKey(name: string): string {
  return getPublisherSlug(name) || name.trim().toLocaleLowerCase();
}

/**
 * Most frequent value; a tie goes to whichever the newest signal carries,
 * because `values` arrives newest first.
 */
function mostFrequent<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best = values[0];
  for (const value of values) {
    if ((counts.get(value) ?? 0) > (counts.get(best) ?? 0)) {
      best = value;
    }
  }
  return best;
}

export function buildSourceDirectory(
  technologies: readonly TechnologyItem[]
): SourceDirectory {
  // getAllTechnologies() is published-only already; checked again here so a
  // caller handing in a workspace list cannot put a draft on a public page.
  const published = technologies.filter((item) => item.status === "published");

  const groups = new Map<string, TechnologyItem[]>();
  let publisherNameFallbacks = 0;

  for (const item of published) {
    const name = getSignalPublisherName(item);
    if (!item.publisherName?.trim()) {
      publisherNameFallbacks += 1;
    }
    if (!name) {
      continue;
    }
    const key = groupKey(name);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const entries = [...groups.values()].map((items): SourceDirectoryEntry => {
    // Newest first; a stable sort keeps the caller's order on the same day,
    // which for getAllTechnologies() is the 精选 list's order.
    const newestFirst = [...items].sort((left, right) =>
      right.publishDate.localeCompare(left.publishDate)
    );
    const latest = newestFirst[0];
    const publisherType = mostFrequent(
      newestFirst.map((item) => item.publisherType)
    );

    const sourceCounts = new Map<string, number>();
    for (const item of newestFirst) {
      const sourceName = item.sourceName.trim();
      if (sourceName) {
        sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1);
      }
    }
    const sourceNames = [...sourceCounts.entries()]
      .sort(
        ([leftName, leftCount], [rightName, rightCount]) =>
          rightCount - leftCount || compareNames(leftName, rightName)
      )
      .map(([sourceName]) => sourceName);

    return {
      publisherName: getSignalPublisherName(latest),
      publisherType,
      publisherTypeLabel: getPublisherTypeLabel(publisherType, "zh"),
      signalCount: items.length,
      recent: newestFirst.slice(0, recentSignalLimit).map((item) => ({
        title: getPreferredTechnologyTitle(item),
        slug: item.slug,
        publishDate: item.publishDate
      })),
      sourceNames
    };
  });

  entries.sort(
    (left, right) =>
      right.signalCount - left.signalCount ||
      compareNames(left.publisherName, right.publisherName)
  );

  return {
    entries,
    totals: {
      publishers: entries.length,
      signals: entries.reduce((sum, entry) => sum + entry.signalCount, 0),
      sources: new Set(entries.flatMap((entry) => entry.sourceNames)).size,
      publisherNameFallbacks
    }
  };
}

/**
 * The entries split by publisher type, the section with the most signals
 * first. Entries keep the directory's order inside a section.
 */
export function groupSourceDirectoryByPublisherType(
  entries: readonly SourceDirectoryEntry[]
): SourceDirectorySection[] {
  const sections = new Map<PublisherType, SourceDirectorySection>();

  for (const entry of entries) {
    const section = sections.get(entry.publisherType) ?? {
      publisherType: entry.publisherType,
      label: entry.publisherTypeLabel,
      signalCount: 0,
      entries: []
    };
    section.signalCount += entry.signalCount;
    section.entries.push(entry);
    sections.set(entry.publisherType, section);
  }

  return [...sections.values()].sort(
    (left, right) =>
      right.signalCount - left.signalCount ||
      publisherTypeOrder.indexOf(left.publisherType) -
        publisherTypeOrder.indexOf(right.publisherType)
  );
}

/**
 * The name a signal is filed under here: its publisher, or the feed it came
 * through when the publisher is blank.
 */
export function getSignalPublisherName(
  item: Pick<TechnologyItem, "publisherName" | "sourceName">
): string {
  return item.publisherName?.trim() || item.sourceName.trim();
}

/**
 * The publisher's slug: lower case, every run of anything but letters and
 * digits one hyphen. Letters include CJK, so 量子位 stays 量子位. It is the
 * card's anchor after `publisher-` and the `/technologies?publisher=` value.
 */
export function getPublisherSlug(publisherName: string): string {
  return publisherName
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** The card's fragment id, so `/sources#…` can point at one publisher. */
export function getSourceDirectoryAnchor(publisherName: string): string {
  return `publisher-${getPublisherSlug(publisherName)}`;
}

/** The publisher's card on /sources. */
export function getSourceDirectoryHref(publisherName: string): string {
  return `/sources#${getSourceDirectoryAnchor(publisherName)}`;
}

/** The 精选 list narrowed to this publisher's signals. */
export function getPublisherSignalsHref(publisherName: string): string {
  return `/technologies?publisher=${encodeURIComponent(
    getPublisherSlug(publisherName)
  )}`;
}
