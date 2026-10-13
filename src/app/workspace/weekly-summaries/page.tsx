import { WeeklySummaryWorkspaceCard } from "@/components/weekly-summary-workspace";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getWeeklyReview, getWeeklyReviewArchive } from "@/lib/weekly-review";
import { getWeeklySummaries } from "@/lib/weekly-summary";

export const dynamic = "force-dynamic";

export default function WorkspaceWeeklySummariesPage() {
  const currentWeekKey = getWeeklyReview()?.weekKey ?? "";
  // Weeks with at least one shown signal, up to this week: the set the
  // public pages and the weekly RSS can show a summary on.
  const weeks = getWeeklyReviewArchive().filter(
    (week) => week.weekKey <= currentWeekKey
  );
  const records = new Map(
    getWeeklySummaries().map((record) => [record.weekKey, record])
  );
  const publishedCount = [...records.values()].filter(
    (record) => record.status === "published"
  ).length;
  const draftCount = records.size - publishedCount;

  return (
    <WorkspacePageShell
      title="周总结"
      description="为公开周回顾写一段编辑总结：可以先让 AI 起草，改完保存草稿，再单独发布。"
      sectionLabel="周总结"
    >
      <section
        className="workspace-status-overview"
        aria-label="周总结状态总览"
      >
        <div className="workspace-status-overview__card">
          <span>有信号的周</span>
          <strong>{weeks.length}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>草稿</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>已发布</span>
          <strong>{publishedCount}</strong>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${weeks.length} 周`}
        detail="周回顾本身仍按已发布信号自动汇总，这里只管它上面那段总结。没有发布总结的周，公开页照旧不显示。"
      />

      <div className="workspace-compact-list digest-workspace-list">
        {weeks.map((week) => (
          <WeeklySummaryWorkspaceCard
            key={week.weekKey}
            week={week}
            record={records.get(week.weekKey)}
            isCurrentWeek={week.weekKey === currentWeekKey}
          />
        ))}
      </div>

      {weeks.length === 0 ? (
        <p className="empty-state">还没有任何一周有已发布的信号。</p>
      ) : null}
    </WorkspacePageShell>
  );
}
