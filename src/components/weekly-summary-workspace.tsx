import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import type { WeeklyReviewArchiveEntry } from "@/lib/weekly-review";
import type { WeeklySummaryRecord } from "@/lib/weekly-summary";

export function getWeeklySummaryStatusBadge(record?: WeeklySummaryRecord) {
  if (record?.status === "published") {
    return { label: "已发布", tone: "success" as const };
  }

  return record
    ? { label: "草稿", tone: "warning" as const }
    : { label: "没有总结", tone: "neutral" as const };
}

/** Workspace-only: one row per week on /workspace/weekly-summaries. */
export function WeeklySummaryWorkspaceCard({
  week,
  record,
  isCurrentWeek
}: {
  week: WeeklyReviewArchiveEntry;
  record?: WeeklySummaryRecord;
  isCurrentWeek: boolean;
}) {
  const href = `/workspace/weekly-summaries/${week.weekKey}`;
  const badge = getWeeklySummaryStatusBadge(record);
  const text = record?.text.trim() ?? "";

  return (
    <article className="workspace-record-card digest-workspace-card">
      <div className="candidate-card__meta">
        <div className="candidate-card__meta-row">
          <WorkspaceStatusBadge label={badge.label} tone={badge.tone} />
          <span className="candidate-card__source-name">
            {week.weekKey}
            {isCurrentWeek ? " · 本周" : ""}
          </span>
        </div>
        <MetadataRow
          items={[
            { label: "立即关注", value: week.highPriorityCount },
            { label: "值得跟踪", value: week.watchCount },
            { label: "更新于", value: record?.updatedAt.slice(0, 10) },
            { label: "发布于", value: record?.publishedAt?.slice(0, 10) }
          ]}
        />
      </div>

      <div className="candidate-card__body">
        <h2>
          <Link href={href}>{week.rangeLabel}</Link>
        </h2>
        <p>
          {text
            ? `${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`
            : `这一周 ${week.totalCount} 条信号，还没有写总结。`}
        </p>
      </div>

      <div className="digest-workspace-card__links">
        <Link href={href} className="action-link">
          {record ? "编辑总结" : "写总结"}
        </Link>
        <Link href={`/digest/weekly/${week.weekKey}`} className="action-link">
          打开公开周回顾
        </Link>
      </div>
    </article>
  );
}
