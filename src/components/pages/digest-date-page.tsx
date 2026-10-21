import { notFound } from "next/navigation";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { JsonLd } from "@/components/json-ld";
import { UserPageShell } from "@/components/user-page-shell";
import { getPublishedDailyDigestByDate } from "@/lib/digest-workflow";
import {
  getDailyDigestRenderData,
  getPublishedDigestNeighbors,
  toPublicDigestView
} from "@/lib/digest-view";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";
import type { Metadata } from "next";
import { digestCopy } from "@/lib/i18n/copy/digest";
import type { Locale } from "@/lib/i18n/locale";
import { localizeTags } from "@/lib/i18n/topic-names";
import { buildPageMetadata } from "@/lib/site-metadata";
import { buildDigestJsonLd } from "@/lib/structured-data";

export interface DigestDatePageProps {
  params: Promise<{ date: string }>;
}

export async function generateDigestDatePageMetadata(
  locale: Locale,
  { params }: DigestDatePageProps
): Promise<Metadata> {
  const { date } = await params;
  const digest = getPublishedDailyDigestByDate(date);

  if (!digest) {
    return buildPageMetadata({
      title: digestCopy[locale].today.notFoundTitle,
      path: `/digest/${date}`,
      noIndex: true,
      locale
    });
  }

  return buildPageMetadata({
    title: getPublicDigestTitle(digest),
    description: getPublicDigestSummaryPlainText(digest),
    path: `/digest/${digest.date}`,
    type: "article",
    publishedTime: digest.publishedAt ?? digest.date,
    largeImage: true,
    locale
  });
}

export async function DigestDatePage({
  params,
  locale
}: DigestDatePageProps & { locale: Locale }) {
  const { date } = await params;
  const digest = getPublishedDailyDigestByDate(date);

  if (!digest) {
    notFound();
  }

  const publicTitle = getPublicDigestTitle(digest);
  const publicSummary = getPublicDigestSummaryPlainText(digest);
  const sourceRenderData = getDailyDigestRenderData(digest);
  const renderData = {
    ...sourceRenderData,
    tags: localizeTags(sourceRenderData.tags, locale)
  };

  return (
    <>
      <UserPageShell
        title={publicTitle}
        description={publicSummary}
        sectionLabel={digestCopy[locale].today.sectionLabel}
        showHeader={false}
        className="dossier"
      >
        <DailyDigestContent
          digest={toPublicDigestView(digest)}
          showDeliveryLinks
          neighbors={getPublishedDigestNeighbors(digest.date)}
          {...renderData}
        />
      </UserPageShell>
      <JsonLd
        data={buildDigestJsonLd(
          {
            date: digest.date,
            title: publicTitle,
            summary: publicSummary,
            path: `/digest/${digest.date}`,
            technologies: [
              ...renderData.highPriorityTechnologies,
              ...renderData.watchTechnologies
            ]
          },
          undefined,
          locale
        )}
      />
    </>
  );
}
