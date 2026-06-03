import Link from "next/link";

import { TechnologyDraftCard } from "@/components/technology-draft-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getTechnologyWorkspaceRecords } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function WorkspaceTechnologiesPage() {
  const records = getTechnologyWorkspaceRecords();
  const draftCount = records.filter((record) => record.status === "draft").length;
  const publishedCount = records.filter(
    (record) => record.status === "published"
  ).length;
  const archivedCount = records.filter(
    (record) => record.status === "archived"
  ).length;

  return (
    <WorkspacePageShell
      title="Technology Workspace"
      description="Internal technology records generated from imported candidates. Review draft quality, keep source links, and control publication state."
      sectionLabel="Draft Control"
    >
      <section className="workspace-status-overview" aria-label="Technology status overview">
        <div className="workspace-status-overview__card">
          <span>Drafts waiting for review</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>Published to user product</span>
          <strong>{publishedCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>Archived records</span>
          <strong>{archivedCount}</strong>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${records.length} workspace records`}
        detail="Draft, published, and archived records stay here before they become user-facing content."
      />

      <div className="content-grid candidate-grid">
        {records.map((record) => (
          <TechnologyDraftCard key={record.id} draft={record} />
        ))}
      </div>

      {records.length === 0 ? (
        <section className="empty-state empty-state--actionable">
          <div>
            <strong>No technology drafts yet.</strong>
            <p>
              Technology detail pages are created only after an imported candidate is
              converted into a draft. Start from Candidates, open a candidate, then use
              Convert to technology draft.
            </p>
          </div>
          <Link href="/workspace/candidates" className="action-link">
            Review candidates to create a draft
          </Link>
        </section>
      ) : null}
    </WorkspacePageShell>
  );
}
