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
import { buildPageMetadata } from "@/lib/site-metadata";
import { buildDigestJsonLd } from "@/lib/structured-data";

interface DigestDatePageProps {
  params: Promise<{ date: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: DigestDatePageProps): Promise<Metadata> {
  const { date } = await params;
  const digest = getPublishedDailyDigestByDate(date);

  if (!digest) {
    return buildPageMetadata({
      title: "没有这一页",
      path: `/digest/${date}`,
      noIndex: true
    });
  }

  return buildPageMetadata({
    title: getPublicDigestTitle(digest),
    description: getPublicDigestSummaryPlainText(digest),
    path: `/digest/${digest.date}`,
    type: "article",
    largeImage: true
  });
}

export default async function DigestDatePage({ params }: DigestDatePageProps) {
  const { date } = await params;
  const digest = getPublishedDailyDigestByDate(date);

  if (!digest) {
    notFound();
  }

  const publicTitle = getPublicDigestTitle(digest);
  const publicSummary = getPublicDigestSummaryPlainText(digest);
  const renderData = getDailyDigestRenderData(digest);

  return (
    <>
      <UserPageShell
        title={publicTitle}
        description={publicSummary}
        sectionLabel="技术简报"
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
        data={buildDigestJsonLd({
          date: digest.date,
          title: publicTitle,
          summary: publicSummary,
          path: `/digest/${digest.date}`,
          technologies: [
            ...renderData.highPriorityTechnologies,
            ...renderData.watchTechnologies
          ]
        })}
      />
    </>
  );
}
