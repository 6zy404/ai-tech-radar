import { DailyDigestWorkspaceCard } from "@/components/daily-digest-workspace-card";
import { GenerateDigestAction } from "@/components/daily-digest-workspace-actions";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getTodayDateString } from "@/lib/digest-store";
import { getDailyDigests } from "@/lib/digest-workflow";

export const dynamic = "force-dynamic";

export default function WorkspaceDigestsPage() {
  const digests = getDailyDigests();
  const draftCount = digests.filter(
    (digest) => digest.status === "draft"
  ).length;
  const publishedCount = digests.filter(
    (digest) => digest.status === "published"
  ).length;
  const archivedCount = digests.filter(
    (digest) => digest.status === "archived"
  ).length;

  return (
    <WorkspacePageShell
      title="每日简报"
      description="基于已发布技术记录和 Ranking v0 优先级，生成、编辑、预览、校验并发布每日简报。"
      sectionLabel="简报管理"
    >
      <GenerateDigestAction date={getTodayDateString()} />

      <section className="workspace-status-overview" aria-label="简报状态总览">
        <div className="workspace-status-overview__card">
          <span>草稿简报</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>已发布简报</span>
          <strong>{publishedCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>已归档简报</span>
          <strong>{archivedCount}</strong>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${digests.length} 条简报记录`}
        detail="简报编辑工作流会把人工调整与生成的排序板块分开保存。它不是推送投递、邮件或个性化功能。"
      />

      <div className="workspace-compact-list digest-workspace-list">
        {digests.map((digest) => (
          <DailyDigestWorkspaceCard key={digest.id} digest={digest} />
        ))}
      </div>

      {digests.length === 0 ? (
        <p className="empty-state">
          还没有生成过简报。生成一份简报草稿即可查看第一份工作台审核稿。
        </p>
      ) : null}
    </WorkspacePageShell>
  );
}
