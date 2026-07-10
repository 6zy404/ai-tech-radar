import { DuplicateGroupCard } from "@/components/duplicate-group-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";

export const dynamic = "force-dynamic";

export default function WorkspaceDuplicatesPage() {
  const { candidates, duplicateGroups } = getCandidateWorkflowData();
  const openCount = duplicateGroups.filter(
    (group) => group.status === "open"
  ).length;
  const resolvedCount = duplicateGroups.filter(
    (group) => group.status === "resolved"
  ).length;
  const ignoredCount = duplicateGroups.filter(
    (group) => group.status === "ignored"
  ).length;

  return (
    <WorkspacePageShell
      title="重复组审核"
      description="疑似重复导入候选的内部审核队列。在生成正式技术草稿前先处理重复组。"
      sectionLabel="候选去重"
    >
      <div className="workspace-status-overview">
        <article className="workspace-status-overview__card">
          <span>待处理</span>
          <strong>{openCount}</strong>
        </article>
        <article className="workspace-status-overview__card">
          <span>已解决</span>
          <strong>{resolvedCount}</strong>
        </article>
        <article className="workspace-status-overview__card">
          <span>已忽略</span>
          <strong>{ignoredCount}</strong>
        </article>
      </div>

      <WorkspaceListToolbar
        label={`${duplicateGroups.length} 个重复组`}
        detail="选择主候选、解决真实重复，或忽略误报。"
      />

      <div className="content-grid candidate-grid">
        {duplicateGroups.map((group) => (
          <DuplicateGroupCard
            key={group.id}
            group={group}
            candidates={group.candidateIds
              .map((candidateId) =>
                candidates.find((candidate) => candidate.id === candidateId)
              )
              .filter((candidate): candidate is (typeof candidates)[number] =>
                Boolean(candidate)
              )}
          />
        ))}
      </div>

      {duplicateGroups.length === 0 ? (
        <p className="empty-state">当前没有检测到重复组。</p>
      ) : null}
    </WorkspacePageShell>
  );
}
