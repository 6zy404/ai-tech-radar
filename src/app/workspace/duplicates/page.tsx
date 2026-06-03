import { DuplicateGroupCard } from "@/components/duplicate-group-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";

export const dynamic = "force-dynamic";

export default function WorkspaceDuplicatesPage() {
  const { candidates, duplicateGroups } = getCandidateWorkflowData();
  const openCount = duplicateGroups.filter((group) => group.status === "open").length;
  const resolvedCount = duplicateGroups.filter(
    (group) => group.status === "resolved"
  ).length;
  const ignoredCount = duplicateGroups.filter(
    (group) => group.status === "ignored"
  ).length;

  return (
    <WorkspacePageShell
      title="Duplicate Review"
      description="Internal review queue for possible duplicate imported candidates. Resolve groups before generating formal technology drafts."
      sectionLabel="Candidate Deduplication"
    >
      <div className="workspace-status-overview">
        <article className="workspace-status-overview__card">
          <span>Open groups</span>
          <strong>{openCount}</strong>
        </article>
        <article className="workspace-status-overview__card">
          <span>Resolved groups</span>
          <strong>{resolvedCount}</strong>
        </article>
        <article className="workspace-status-overview__card">
          <span>Ignored groups</span>
          <strong>{ignoredCount}</strong>
        </article>
      </div>

      <WorkspaceListToolbar
        label={`${duplicateGroups.length} duplicate groups`}
        detail="Select a primary candidate, resolve real duplicates, or ignore false positives."
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
        <p className="empty-state">
          No duplicate groups are currently detected.
        </p>
      ) : null}
    </WorkspacePageShell>
  );
}
