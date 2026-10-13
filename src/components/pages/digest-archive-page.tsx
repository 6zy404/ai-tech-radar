import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UserPageShell } from "@/components/user-page-shell";
import { digestCardSummaryLength } from "@/lib/digest-card-summary";
import { compactText } from "@/lib/compact-text";
import {
  getDailyDigests,
  getDigestTechnologySections
} from "@/lib/digest-workflow";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";
import { digestCopy } from "@/lib/i18n/copy/digest";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";
import { buildPageMetadata } from "@/lib/site-metadata";

export function getDigestArchivePageMetadata(locale: Locale) {
  const copy = digestCopy[locale].archive;

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/digest",
    locale
  });
}

interface ArchiveEntry {
  date: string;
  title: string;
  summary: string;
  highCount: number;
  watchCount: number;
}

interface ArchiveMonth {
  month: string;
  entries: ArchiveEntry[];
}

function getMonthLabel(month: string, locale: Locale): string {
  const [year, monthPart] = month.split("-");

  return digestCopy[locale].archive.month(year, Number(monthPart));
}

function getPublishedArchiveMonths(): ArchiveMonth[] {
  const months = new Map<string, ArchiveEntry[]>();
  const published = getDailyDigests()
    .filter((digest) => digest.status === "published")
    .sort((left, right) => right.date.localeCompare(left.date));

  for (const digest of published) {
    const month = digest.date.slice(0, 7);
    const entries = months.get(month) ?? [];
    // Count what the digest page actually renders, not the generated section
    // arrays. Those arrays ignore exclusions and manual additions, so before
    // 2026-08-16 every entry here read "立即关注 4 条 · 值得跟踪 6 条" — the
    // generator's fixed output — while the digest itself showed something
    // else. Measured then: 12 of 12 published digests disagreed with their
    // own page.
    const { highPriorityTechnologies, watchTechnologies } =
      getDigestTechnologySections(digest);

    entries.push({
      date: digest.date,
      title: getPublicDigestTitle(digest),
      summary: compactText(
        getPublicDigestSummaryPlainText(digest),
        digestCardSummaryLength
      ),
      highCount: highPriorityTechnologies.length,
      watchCount: watchTechnologies.length
    });
    months.set(month, entries);
  }

  return [...months.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([month, entries]) => ({ month, entries }));
}

export function DigestArchivePage({ locale }: { locale: Locale }) {
  const copy = digestCopy[locale].archive;
  const archiveMonths = getPublishedArchiveMonths();
  const totalCount = archiveMonths.reduce(
    (count, month) => count + month.entries.length,
    0
  );

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="digest-archive-page dossier"
      actions={
        <>
          <Link
            href={localePath(locale, "/digest/weekly")}
            className="action-link"
          >
            {copy.weekly}
          </Link>
          <Link
            href={localePath(locale, "/digest/today")}
            className="action-link"
          >
            {copy.latest}
          </Link>
        </>
      }
    >
      {archiveMonths.length > 0 ? (
        <>
          <p className="digest-archive__count">{copy.count(totalCount)}</p>
          <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>
          {archiveMonths.map((month) => (
            <section key={month.month} className="digest-archive-month">
              <h2>{getMonthLabel(month.month, locale)}</h2>
              <div className="digest-archive-month__list">
                {month.entries.map((entry) => (
                  <DossierCard key={entry.date} className="digest-archive-card">
                    <div className="digest-archive-card__meta">
                      <span className="digest-archive-card__date">
                        {entry.date}
                      </span>
                      <DossierStampTag>
                        {copy.counts(entry.highCount, entry.watchCount)}
                      </DossierStampTag>
                    </div>
                    <h3 lang={nameLangAttr(locale, entry.title)}>
                      <Link href={localePath(locale, `/digest/${entry.date}`)}>
                        {entry.title}
                      </Link>
                    </h3>
                    <p lang={nameLangAttr(locale, entry.summary)}>
                      {entry.summary}
                    </p>
                    <Link
                      className="digest-archive-card__open"
                      href={localePath(locale, `/digest/${entry.date}`)}
                    >
                      {copy.open}
                    </Link>
                  </DossierCard>
                ))}
              </div>
            </section>
          ))}
        </>
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
    </UserPageShell>
  );
}
