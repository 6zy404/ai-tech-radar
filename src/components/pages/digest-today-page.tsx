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
import { buildPageMetadata } from "@/lib/site-metadata";
import { buildDigestJsonLd } from "@/lib/structured-data";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";

export function generateTodayDigestPageMetadata(): Metadata {
  const latest = getLatestPublishedDailyDigest();

  return buildPageMetadata({
    title: latest ? getPublicDigestTitle(latest) : "技术简报",
    description: latest ? getPublicDigestSummaryPlainText(latest) : undefined,
    path: "/digest/today",
    largeImage: true
  });
}

export function TodayDigestPage() {
  const today = getTodayDateString();
  const todayDigest = getPublishedDailyDigestByDate(today);
  const latestDigest = todayDigest ?? getLatestPublishedDailyDigest();
  const previewNotice = todayDigest
    ? undefined
    : latestDigest
      ? `当前展示的是 ${latestDigest.date} 发布的最新一期简报。`
      : undefined;
  const renderData = latestDigest
    ? getDailyDigestRenderData(latestDigest)
    : undefined;

  return (
    <>
      <UserPageShell
        title="AI 技术简报"
        description="以阅读为先的简报，汇总今天值得关注的技术信号。"
        sectionLabel="技术简报"
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
              <p className="eyebrow user-eyebrow">技术简报</p>
              <h1>今天还没有已发布的简报。</h1>
              <p>
                首期简报发布后，这里会展示当天的内容。在此之前，你可以先浏览技术信号流。
              </p>
              <Link className="action-link" href="/technologies">
                浏览技术信号
              </Link>
            </div>
          </section>
        )}
      </UserPageShell>
      {latestDigest && renderData ? (
        <JsonLd
          data={buildDigestJsonLd({
            date: latestDigest.date,
            title: getPublicDigestTitle(latestDigest),
            summary: getPublicDigestSummaryPlainText(latestDigest),
            path: "/digest/today",
            technologies: [
              ...renderData.highPriorityTechnologies,
              ...renderData.watchTechnologies
            ]
          })}
        />
      ) : null}
    </>
  );
}
