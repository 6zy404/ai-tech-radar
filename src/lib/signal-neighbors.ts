import { compactText } from "@/lib/compact-text";
import { getAllTechnologies } from "@/lib/content";
import type { Locale } from "@/lib/i18n/locale";
import { getTechnologyTitleForLocale } from "@/lib/technology-localization";
import type { TechnologyItem } from "@/types/content";

/**
 * 上一条 / 下一条 on a signal page: the published signals on either side of
 * this one in the 精选 list's default order (最新发布). That order is
 * `getAllTechnologies()` as it comes — newest publish date first, signals of
 * the same day in pool order — and `sortTechnologiesForBrowser` keeps it as
 * is for `latest`. So the neighbours are read off that list by position
 * rather than by re-sorting: a second sort, even one with a tidier
 * tie-break, would disagree with the list on any day with two signals.
 *
 * Publish order only. The 版本脉络 line (`supersedes`) is a different thing
 * and plays no part here.
 */

/**
 * Two lines of a pager tile. 16 of 95 titles were longer (2026-10-02); they
 * are cut at a clause, which keeps the headline before the colon.
 */
export const signalNeighborTitleMaxLength = 40;

export interface SignalNeighbor {
  slug: string;
  title: string;
}

export interface SignalNeighbors {
  /** The one above it in the list: published later. */
  newer?: SignalNeighbor;
  /** The one below it in the list: published earlier. */
  older?: SignalNeighbor;
}

export function findSignalNeighbors<T extends { id: string; slug: string }>(
  signalsInListOrder: readonly T[],
  currentId: string,
  titleOf: (signal: T) => string
): SignalNeighbors {
  const index = signalsInListOrder.findIndex(
    (signal) => signal.id === currentId
  );

  if (index === -1) {
    return {};
  }

  const toNeighbor = (signal: T | undefined): SignalNeighbor | undefined =>
    signal
      ? {
          slug: signal.slug,
          title: compactText(titleOf(signal), signalNeighborTitleMaxLength)
        }
      : undefined;

  return {
    newer: toNeighbor(signalsInListOrder[index - 1]),
    older: toNeighbor(signalsInListOrder[index + 1])
  };
}

export function getSignalNeighbors(
  technologyId: string,
  locale: Locale = "zh"
): SignalNeighbors {
  return findSignalNeighbors(
    getAllTechnologies(),
    technologyId,
    (signal: TechnologyItem) => getTechnologyTitleForLocale(signal, locale).text
  );
}
