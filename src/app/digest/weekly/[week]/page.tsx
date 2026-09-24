import Link from "next/link";
import { notFound } from "next/navigation";

import { WeeklyReviewContent } from "@/components/weekly-review-content";
import { UserPageShell } from "@/components/user-page-shell";
import { getWeeklyReview, getWeeklyReviewArchive } from "@/lib/weekly-review";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

interface WeeklyReviewWeekPageProps {
  params: Promise<{ week: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: WeeklyReviewWeekPageProps): Promise<Metadata> {
  const { week } = await params;
  const data = getWeeklyReview(week);

  if (!data || data.totalCount === 0) {
    return buildPageMetadata({
      title: "没有这一页",
      path: `/digest/weekly/${week}`,
      noIndex: true
    });
  }

  return buildPageMetadata({
    title: `${data.rangeLabel} · 本周回顾`,
    description: `这一周有 ${data.totalCount} 条已发布技术信号：立即关注 ${data.highPriorityCount} 条，值得跟踪 ${data.watchCount} 条，覆盖 ${data.topicCount} 个话题。`,
    path: `/digest/weekly/${data.weekKey}`
  });
}

export default async function WeeklyReviewWeekPage({
  params
}: WeeklyReviewWeekPageProps) {
  const { week } = await params;
  const data = getWeeklyReview(week);

  if (!data || data.totalCount === 0) {
    notFound();
  }

  const archive = getWeeklyReviewArchive({ excludeWeekKey: data.weekKey });

  return (
    <UserPageShell
      title={`周回顾 · ${data.rangeLabel}`}
      description={`${data.rangeLabel}（周一–周日）已发布的技术信号，按优先级汇总。纯派生自已发布信号，无编辑撰写、无 AI。`}
      sectionLabel="周回顾"
      className="weekly-review-page dossier"
      actions={
        <Link href="/digest/weekly" className="action-link">
          回到本周回顾
        </Link>
      }
    >
      <WeeklyReviewContent data={data} archive={archive} />
    </UserPageShell>
  );
}
