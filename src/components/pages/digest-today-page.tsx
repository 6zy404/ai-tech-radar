import Link from "next/link";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { JsonLd } from "@/components/json-ld";
import { UserPageShell } from "@/components/user-page-shell";
import { getTodayDateString } from "@/lib/digest-store";
import {
  getDailyDigestRenderData,
  getPublishedDigestNeighbors,
  toPublicDigestView
} from "@/lib/digest-view";
import {
  getLatestPublishedDailyDigest,
  getPublishedDailyDigestByDate
} from "@/lib/digest-workflow";
import type { Metadata } from "next";
import { digestCopy } from "@/lib/i18n/copy/digest";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { localizeTags } from "@/lib/i18n/topic-names";
import { buildPageMetadata } from "@/lib/site-metadata";
import { buildDigestJsonLd } from "@/lib/structured-data";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";

export function generateTodayDigestPageMetadata(locale: Locale): Metadata {
  const latest = getLatestPublishedDailyDigest();

  return buildPageMetadata({
    title: latest
      ? getPublicDigestTitle(latest)
      : digestCopy[locale].today.fallbackTitle,
    description: latest ? getPublicDigestSummaryPlainText(latest) : undefined,
    path: "/digest/today",
    largeImage: true,
    locale
  });
}

export function TodayDigestPage({ locale }: { locale: Locale }) {
  const copy = digestCopy[locale].today;
  const today = getTodayDateString();
  const todayDigest = getPublishedDailyDigestByDate(today);
  const latestDigest = todayDigest ?? getLatestPublishedDailyDigest();
  const previewNotice = todayDigest
    ? undefined
    : latestDigest
      ? copy.showingLatest(latestDigest.date)
      : undefined;
  const sourceRenderData = latestDigest
    ? getDailyDigestRenderData(latestDigest)
    : undefined;
  const renderData = sourceRenderData
    ? { ...sourceRenderData, tags: localizeTags(sourceRenderData.tags, locale) }
    : undefined;

  return (
    <>
      <UserPageShell
        title={copy.shellTitle}
        description={copy.shellDescription}
        sectionLabel={copy.sectionLabel}
        showHeader={false}
        className="dossier"
      >
        {latestDigest && renderData ? (
          <DailyDigestContent
            digest={toPublicDigestView(latestDigest)}
            previewNotice={previewNotice}
            showDeliveryLinks
            neighbors={getPublishedDigestNeighbors(latestDigest.date)}
            {...renderData}
          />
        ) : (
          <section className="daily-digest-empty">
            <div>
              <p className="eyebrow user-eyebrow">{copy.emptyEyebrow}</p>
              <h1>{copy.emptyTitle}</h1>
              <p>{copy.emptyBody}</p>
              <Link
                className="action-link"
                href={localePath(locale, "/technologies")}
              >
                {copy.browse}
              </Link>
            </div>
          </section>
        )}
      </UserPageShell>
      {latestDigest && renderData ? (
        <JsonLd
          data={buildDigestJsonLd(
            {
              date: latestDigest.date,
              title: getPublicDigestTitle(latestDigest),
              summary: getPublicDigestSummaryPlainText(latestDigest),
              path: "/digest/today",
              technologies: [
                ...renderData.highPriorityTechnologies,
                ...renderData.watchTechnologies
              ]
            },
            undefined,
            locale
          )}
        />
      ) : null}
    </>
  );
}
