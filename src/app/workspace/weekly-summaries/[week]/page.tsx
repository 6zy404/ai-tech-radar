import Link from "next/link";
import { notFound } from "next/navigation";

import { WeeklySummaryEditor } from "@/components/weekly-summary-editor";
import { getWeeklySummaryStatusBadge } from "@/components/weekly-summary-workspace";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { getWeeklyReview } from "@/lib/weekly-review";
import {
  getWeeklySummary,
  getWeeklySummaryPublishBlockers,
  WEEKLY_SUMMARY_MAX_CHARS
} from "@/lib/weekly-summary";
import { getWorkflowEventsForEntity } from "@/lib/workflow-events";

interface WorkspaceWeeklySummaryPageProps {
  params: Promise<{ week: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceWeeklySummaryPage({
  params
}: WorkspaceWeeklySummaryPageProps) {
  const { week } = await params;
  const data = getWeeklyReview(week);

  if (!data || data.totalCount === 0) {
    notFound();
  }

  const record = getWeeklySummary(data.weekKey);
  const badge = getWeeklySummaryStatusBadge(record);
  const blockers =
    record?.status === "draft" ? getWeeklySummaryPublishBlockers(record) : [];

  return (
    <WorkspacePageShell
      title={`周总结 · ${data.rangeLabel}`}
      description={`这一周 ${data.totalCount} 条信号：立即关注 ${data.highPriorityCount}，值得跟踪 ${data.watchCount}。`}
      sectionLabel="周总结"
    >
      <section className="detail-panel">
        <div className="candidate-card__meta-row">
          <WorkspaceStatusBadge label={badge.label} tone={badge.tone} />
          <Link
            href={`/digest/weekly/${data.weekKey}`}
            className="action-link"
          >
            打开公开周回顾
          </Link>
        </div>
        {blockers.length > 0 ? (
          <p className="candidate-review-actions__message">
            暂时不能发布：{blockers.join("")}
          </p>
        ) : null}
      </section>

      <WeeklySummaryEditor
        weekKey={data.weekKey}
        initialText={record?.text ?? ""}
        status={record?.status}
        maxChars={WEEKLY_SUMMARY_MAX_CHARS}
      />

      <section className="detail-panel">
        <h2>这一周的信号</h2>
        <p>AI 起草时按这里的分组和顺序读它们的标题、摘要和「为什么重要」。</p>
        {data.groups.map((group) => (
          <div key={group.level}>
            <h3>
              {getPriorityLevelLabel(group.level, "zh")} · {group.signals.length}{" "}
              条
            </h3>
            <ul>
              {group.signals.map((signal) => (
                <li key={signal.slug}>
                  {signal.publishDate} ·{" "}
                  <Link href={`/technologies/${signal.slug}`}>
                    {signal.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <WorkflowEventList
        events={getWorkflowEventsForEntity("weekly_summary", data.weekKey)}
      />
    </WorkspacePageShell>
  );
}
