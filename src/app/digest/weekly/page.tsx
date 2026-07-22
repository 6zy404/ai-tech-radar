import Link from "next/link";

import { WeeklyReviewContent } from "@/components/weekly-review-content";
import { UserPageShell } from "@/components/user-page-shell";
import { getWeeklyReview, getWeeklyReviewArchive } from "@/lib/weekly-review";

export const dynamic = "force-dynamic";

export default function WeeklyReviewPage() {
  const data = getWeeklyReview();

  if (!data) {
    return (
      <UserPageShell
        title="本周回顾"
        description="按自然周汇总的已发布技术信号。"
        sectionLabel="周回顾"
        className="weekly-review-page dossier"
      >
        <div className="empty-state">
          <strong>暂时无法生成本周回顾。</strong>
          <p>技术信号发布后会在这里按周汇总。</p>
        </div>
      </UserPageShell>
    );
  }

  const archive = getWeeklyReviewArchive({ excludeWeekKey: data.weekKey });

  return (
    <UserPageShell
      title="本周回顾"
      description={`${data.rangeLabel}（周一–周日）已发布的技术信号，按优先级汇总。纯派生自已发布信号，无编辑撰写、无 AI。`}
      sectionLabel="周回顾"
      className="weekly-review-page dossier"
      actions={
        <Link href="/digest/today" className="action-link">
          阅读每日简报
        </Link>
      }
    >
      <WeeklyReviewContent data={data} archive={archive} />
    </UserPageShell>
  );
}
