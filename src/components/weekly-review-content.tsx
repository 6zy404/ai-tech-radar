import Link from "next/link";

import { ContentBody } from "@/components/content-body";
import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { IssuePager } from "@/components/issue-pager";
import { ReadingProgress } from "@/components/reading-progress";
import { LangScope } from "@/components/lang-scope";
import { weeklyReviewFeedPath } from "@/lib/feed-paths";
import { weeklyCopy } from "@/lib/i18n/copy/weekly";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import type {
  WeeklyReviewArchiveEntry,
  WeeklyReviewData,
  WeeklyReviewGroup,
  WeeklyReviewNeighbor,
  WeeklyReviewNeighbors
} from "@/lib/weekly-review";

interface WeeklyReviewContentProps {
  data: WeeklyReviewData;
  archive: WeeklyReviewArchiveEntry[];
  neighbors: WeeklyReviewNeighbors;
  /**
   * The week's published 本周总结 (`getPublishedWeeklySummaryText`), or
   * nothing. Editor-confirmed text, so it carries no AI disclaimer.
   */
  summary?: string;
  locale?: Locale;
}

function toPagerTarget(
  neighbor: WeeklyReviewNeighbor | undefined,
  locale: Locale
) {
  return neighbor
    ? {
        href: localePath(locale, `/digest/weekly/${neighbor.weekKey}`),
        label: neighbor.rangeLabel
      }
    : undefined;
}

export function WeeklyReviewContent({
  data,
  archive,
  neighbors,
  summary,
  locale = "zh"
}: WeeklyReviewContentProps) {
  const copy = weeklyCopy[locale];
  const groupLede: Record<WeeklyReviewGroup["level"], string> = copy.groupLedes;

  return (
    <div className="weekly-review">
      <div className="weekly-review__stats">
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">
            {copy.stats.signals}
          </span>
          <span className="weekly-review-stat__value">{data.totalCount}</span>
        </div>
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">{copy.stats.high}</span>
          <span className="weekly-review-stat__value">
            {data.highPriorityCount}
          </span>
        </div>
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">{copy.stats.watch}</span>
          <span className="weekly-review-stat__value">{data.watchCount}</span>
        </div>
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">{copy.stats.topics}</span>
          <span className="weekly-review-stat__value">{data.topicCount}</span>
        </div>
      </div>

      {/* The same panel as a digest's 今日概览, so the two read alike. */}
      {summary ? (
        <section className="daily-digest-summary-panel weekly-review-summary">
          <h2 className="eyebrow user-eyebrow">{copy.summaryHeading}</h2>
          <LangScope lang={nameLangAttr(locale, summary)}>
            <ContentBody body={summary} />
          </LangScope>
        </section>
      ) : null}

      {data.totalCount > 0 ? (
        data.groups.map((group) => (
          <section key={group.level} className="weekly-review-group">
            <div className="weekly-review-group__heading">
              <h2>{getPriorityLevelLabel(group.level, "zh", locale)}</h2>
              <span>{copy.groupCount(group.signals.length)}</span>
            </div>
            <p className="weekly-review-group__lede">
              {groupLede[group.level]}
            </p>
            <div className="weekly-review-group__list">
              {group.signals.map((signal) => (
                <DossierCard key={signal.slug} className="weekly-review-card">
                  <div className="weekly-review-card__meta">
                    <span className="weekly-review-card__date">
                      {signal.publishDate}
                    </span>
                    <span lang={nameLangAttr(locale, signal.sourceName)}>
                      {copy.sourcePrefix}
                      {signal.sourceName}
                    </span>
                    <DossierStampTag>
                      {getPriorityLevelLabel(signal.level, "zh", locale)}
                    </DossierStampTag>
                  </div>
                  <h3 lang={signal.titleLang}>
                    <Link
                      href={localePath(locale, `/technologies/${signal.slug}`)}
                    >
                      {signal.title}
                    </Link>
                  </h3>
                  <p lang={signal.summaryLang}>{signal.summary}</p>
                </DossierCard>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state empty-state--actionable">
          <strong>{copy.emptyTitle}</strong>
          <p>{copy.emptyBody}</p>
          <Link
            href={localePath(locale, "/technologies")}
            className="action-link"
          >
            {copy.browse}
          </Link>
        </div>
      )}

      <IssuePager
        unit="周"
        ariaLabel={copy.pagerLabel}
        locale={locale}
        previous={toPagerTarget(neighbors.previous, locale)}
        next={toPagerTarget(neighbors.next, locale)}
      />

      {archive.length > 0 ? (
        <section className="weekly-review-archive">
          <div className="weekly-review-archive__heading">
            <h2>{copy.archiveHeading}</h2>
            <span>{copy.archiveCount(archive.length)}</span>
          </div>
          <div className="weekly-review-archive__list">
            {archive.map((entry) => (
              <Link
                key={entry.weekKey}
                href={localePath(locale, `/digest/weekly/${entry.weekKey}`)}
                className="weekly-review-archive__row"
              >
                <span className="weekly-review-archive__range">
                  {entry.rangeLabel}
                </span>
                <span className="weekly-review-archive__counts">
                  {copy.archiveCounts(
                    entry.highPriorityCount,
                    entry.watchCount,
                    entry.totalCount
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="weekly-review-group">
        <div className="weekly-review-group__heading">
          <h2>{copy.subscribeHeading}</h2>
          <span>{copy.subscribeCadence}</span>
        </div>
        <div className="digest-feed-links">
          <Link href={weeklyReviewFeedPath}>{copy.subscribeLink}</Link>
          <span className="weekly-review-group__lede">
            {copy.subscribeHint}
          </span>
        </div>
      </section>
      <ReadingProgress regionSelector=".weekly-review" />
    </div>
  );
}
