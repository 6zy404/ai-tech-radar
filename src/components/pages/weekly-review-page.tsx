import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { WeeklyReviewContent } from "@/components/weekly-review-content";
import { UserPageShell } from "@/components/user-page-shell";
import { weeklyCopy } from "@/lib/i18n/copy/weekly";
import { localePath, type Locale } from "@/lib/i18n/locale";
import {
  describeWeeklyReview,
  getWeeklyReview,
  getWeeklyReviewArchive,
  getWeeklyReviewNeighbors,
  localizeWeekRanges,
  localizeWeeklyReview
} from "@/lib/weekly-review";
import { getPublishedWeeklySummaryText } from "@/lib/weekly-summary";
import { buildPageMetadata, weeklyReviewFeed } from "@/lib/site-metadata";

export function getWeeklyReviewPageMetadata(locale: Locale) {
  const copy = weeklyCopy[locale];
  const week = getWeeklyReview();

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    // Once this week has a shown signal it also lives at
    // /digest/weekly/<monday>, which is where the canonical points; before
    // that the week page would 404, so this address stays its own canonical
    // (seo-2). Read per request — the route files export generateMetadata.
    path:
      week && week.totalCount > 0
        ? `/digest/weekly/${week.weekKey}`
        : "/digest/weekly",
    feeds: [weeklyReviewFeed],
    largeImage: true,
    locale
  });
}

export function WeeklyReviewPage({ locale }: { locale: Locale }) {
  const copy = weeklyCopy[locale];
  const sourceData = getWeeklyReview();

  if (!sourceData) {
    return (
      <UserPageShell
        title={copy.title}
        description={copy.description}
        sectionLabel={copy.sectionLabel}
        className="weekly-review-page dossier"
      >
        <div className="empty-state">
          <strong>{copy.unavailableTitle}</strong>
          <p>{copy.unavailableBody}</p>
        </div>
      </UserPageShell>
    );
  }

  const data = localizeWeeklyReview(sourceData, locale);
  const archive = localizeWeekRanges(
    getWeeklyReviewArchive({ excludeWeekKey: data.weekKey }),
    locale
  );
  const neighbors = getWeeklyReviewNeighbors(data.weekKey);
  const summary = getPublishedWeeklySummaryText(data.weekKey);

  return (
    <UserPageShell
      title={copy.title}
      description={describeWeeklyReview(
        data.rangeLabel,
        Boolean(summary),
        locale
      )}
      sectionLabel={copy.sectionLabel}
      className="weekly-review-page dossier"
      actions={
        <Link
          href={localePath(locale, "/digest/today")}
          className="action-link"
        >
          {copy.readDigest}
        </Link>
      }
    >
      <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>
      <WeeklyReviewContent
        data={data}
        archive={archive}
        neighbors={{
          previous: neighbors.previous
            ? localizeWeekRanges([neighbors.previous], locale)[0]
            : undefined,
          next: neighbors.next
            ? localizeWeekRanges([neighbors.next], locale)[0]
            : undefined
        }}
        summary={summary}
        locale={locale}
      />
    </UserPageShell>
  );
}
