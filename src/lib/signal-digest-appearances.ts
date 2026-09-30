import { getAllTechnologies } from "@/lib/content";
import {
  getDailyDigests,
  getDigestTechnologySections
} from "@/lib/digest-workflow";
import { getPublicDigestTitle } from "@/lib/public-copy";
import { getWeeklyReview, type WeeklyReviewLevel } from "@/lib/weekly-review";
import type { DailyDigest, TechnologyItem } from "@/types/content";

/**
 * 收录于: the public issues a published signal appeared in — the technology
 * briefs that carried it and the weekly review of its week. A derived view
 * only. Membership is decided by the same functions the issue pages render
 * from (`getDigestTechnologySections`, `getWeeklyReview`), so this list
 * cannot claim an issue that does not show the signal, and only public
 * fields leave: the date, the public title, and the section.
 */

/** Both issue kinds use Ranking v0's two shown levels as their sections. */
export type SignalIssueSection = WeeklyReviewLevel;

export interface SignalDigestAppearance {
  date: string;
  title: string;
  section: SignalIssueSection;
  href: string;
}

export interface SignalWeeklyAppearance {
  weekKey: string;
  rangeLabel: string;
  section: SignalIssueSection;
  href: string;
}

export interface SignalIssueAppearances {
  /** Newest first. */
  digests: SignalDigestAppearance[];
  weekly?: SignalWeeklyAppearance;
}

/**
 * The published digests that show `signalId`, newest first, with the section
 * each shows it in. `/digest/[date]` serves the first digest stored for a
 * date and 404s unless it is published, so later duplicates of a date are
 * ignored the same way. Selection is `getDigestTechnologySections`, which is
 * what the page renders — manual additions, exclusions and pins included —
 * and which drops ids that are not published technologies.
 */
export function buildSignalDigestAppearances(
  signalId: string,
  digests: readonly DailyDigest[],
  technologies: TechnologyItem[]
): SignalDigestAppearance[] {
  const servedByDate = new Map<string, DailyDigest>();

  for (const digest of digests) {
    if (!servedByDate.has(digest.date)) {
      servedByDate.set(digest.date, digest);
    }
  }

  const appearances: SignalDigestAppearance[] = [];

  for (const digest of servedByDate.values()) {
    if (digest.status !== "published") {
      continue;
    }

    const { highPriorityTechnologies, watchTechnologies } =
      getDigestTechnologySections(digest, technologies);
    const section: SignalIssueSection | undefined =
      highPriorityTechnologies.some((item) => item.id === signalId)
        ? "high_priority"
        : watchTechnologies.some((item) => item.id === signalId)
          ? "watch"
          : undefined;

    if (section) {
      appearances.push({
        date: digest.date,
        title: getPublicDigestTitle(digest),
        section,
        href: `/digest/${digest.date}`
      });
    }
  }

  return appearances.sort((left, right) => right.date.localeCompare(left.date));
}

/** Monday of the natural week holding `date`, or undefined for a bad date. */
function getMondayKey(date: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return undefined;
  }

  const day = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
    return undefined;
  }

  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));

  return day.toISOString().slice(0, 10);
}

/**
 * The weekly review of the signal's publish week, when that review lists it.
 * `getWeeklyReview` is the page's own data, so a signal it leaves out (a
 * low-priority one) gets no link, and a linked week never 404s.
 */
export function findSignalWeeklyAppearance(
  technology: Pick<TechnologyItem, "slug" | "publishDate">
): SignalWeeklyAppearance | undefined {
  const weekKey = getMondayKey(technology.publishDate);
  const review = weekKey ? getWeeklyReview(weekKey) : undefined;

  if (!review) {
    return undefined;
  }

  const group = review.groups.find((candidate) =>
    candidate.signals.some((signal) => signal.slug === technology.slug)
  );

  return group
    ? {
        weekKey: review.weekKey,
        rangeLabel: review.rangeLabel,
        section: group.level,
        href: `/digest/weekly/${review.weekKey}`
      }
    : undefined;
}

/**
 * The digests that carried a published signal, plus its weekly review.
 * Undefined unless at least one published digest carried it: the weekly
 * review takes in every high- and watch-level signal automatically, so on
 * its own it would put the same section on nearly every page. A draft is in
 * no issue.
 */
export function getSignalIssueAppearances(
  technology: TechnologyItem
): SignalIssueAppearances | undefined {
  if (technology.status !== "published") {
    return undefined;
  }

  const digests = buildSignalDigestAppearances(
    technology.id,
    getDailyDigests(),
    getAllTechnologies()
  );

  return digests.length > 0
    ? { digests, weekly: findSignalWeeklyAppearance(technology) }
    : undefined;
}
