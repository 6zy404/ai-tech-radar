import Link from "next/link";
import { notFound } from "next/navigation";

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
import type { Metadata } from "next";
import { buildPageMetadata, weeklyReviewFeed } from "@/lib/site-metadata";

export interface WeeklyReviewWeekPageProps {
  params: Promise<{ week: string }>;
}

export async function generateWeeklyReviewWeekPageMetadata(
  locale: Locale,
  { params }: WeeklyReviewWeekPageProps
): Promise<Metadata> {
  const copy = weeklyCopy[locale];
  const { week } = await params;
  const sourceData = getWeeklyReview(week);

  if (!sourceData || sourceData.totalCount === 0) {
    return buildPageMetadata({
      title: copy.notFoundTitle,
      path: `/digest/weekly/${week}`,
      noIndex: true,
      locale
    });
  }

  const data = localizeWeeklyReview(sourceData, locale);

  return buildPageMetadata({
    title: copy.weekPageTitle(data.rangeLabel),
    description: copy.weekDescription(
      data.totalCount,
      data.highPriorityCount,
      data.watchCount,
      data.topicCount
    ),
    path: `/digest/weekly/${data.weekKey}`,
    feeds: [weeklyReviewFeed],
    largeImage: true,
    locale
  });
}

export async function WeeklyReviewWeekPage({
  params,
  locale
}: WeeklyReviewWeekPageProps & { locale: Locale }) {
  const copy = weeklyCopy[locale];
  const { week } = await params;
  const sourceData = getWeeklyReview(week);

  if (!sourceData || sourceData.totalCount === 0) {
    notFound();
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
      title={copy.weekShellTitle(data.rangeLabel)}
      description={describeWeeklyReview(
        data.rangeLabel,
        Boolean(summary),
        locale
      )}
      sectionLabel={copy.sectionLabel}
      className="weekly-review-page dossier"
      actions={
        <Link
          href={localePath(locale, "/digest/weekly")}
          className="action-link"
        >
          {copy.backToThisWeek}
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
