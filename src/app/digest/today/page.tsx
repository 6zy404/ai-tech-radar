import Link from "next/link";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getLatestPublishedDailyDigest,
  getPublishedDailyDigestByDate,
  getTodayDateString
} from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";

export const dynamic = "force-dynamic";

export default function TodayDigestPage() {
  const today = getTodayDateString();
  const todayDigest = getPublishedDailyDigestByDate(today);
  const latestDigest = todayDigest ?? getLatestPublishedDailyDigest();
  const previewNotice = todayDigest
    ? undefined
    : latestDigest
      ? `当前展示的是 ${latestDigest.date} 发布的最新一期简报。`
      : undefined;

  return (
    <UserPageShell
      title="AI 技术简报"
      description="以阅读为先的简报，汇总今天值得关注的技术信号。"
      sectionLabel="每日简报"
      showHeader={false}
    >
      {latestDigest ? (
        <DailyDigestContent
          digest={latestDigest}
          previewNotice={previewNotice}
          showDeliveryLinks
          {...getDailyDigestRenderData(latestDigest)}
        />
      ) : (
        <section className="daily-digest-empty">
          <div>
            <p className="eyebrow user-eyebrow">每日简报</p>
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
  );
}
