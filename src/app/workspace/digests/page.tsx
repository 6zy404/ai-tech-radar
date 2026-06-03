import { DailyDigestWorkspaceCard } from "@/components/daily-digest-workspace-card";
import { GenerateDigestAction } from "@/components/daily-digest-workspace-actions";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getDailyDigests,
  getTodayDateString
} from "@/lib/digest-workflow";

export const dynamic = "force-dynamic";

export default function WorkspaceDigestsPage() {
  const digests = getDailyDigests();
  const draftCount = digests.filter((digest) => digest.status === "draft").length;
  const publishedCount = digests.filter(
    (digest) => digest.status === "published"
  ).length;
  const archivedCount = digests.filter(
    (digest) => digest.status === "archived"
  ).length;

  return (
    <WorkspacePageShell
      title="Daily Digests"
      description="Generate, edit, preview, validate, and publish daily briefs built from published TechnologyItem records and Ranking v0 priority levels."
      sectionLabel="Digest Control"
    >
      <GenerateDigestAction date={getTodayDateString()} />

      <section className="workspace-status-overview" aria-label="Digest status overview">
        <div className="workspace-status-overview__card">
          <span>Draft digests</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>Published digests</span>
          <strong>{publishedCount}</strong>
        </div>
        <div className="workspace-status-overview__card">
          <span>Archived digests</span>
          <strong>{archivedCount}</strong>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${digests.length} digest records`}
        detail="Digest editorial workflow keeps manual edits separate from generated ranking sections. It is not push delivery, email, or personalization."
      />

      <div className="content-grid candidate-grid">
        {digests.map((digest) => (
          <DailyDigestWorkspaceCard key={digest.id} digest={digest} />
        ))}
      </div>

      {digests.length === 0 ? (
        <p className="empty-state">
          No digests have been generated yet. Generate a digest draft to inspect
          the first workspace review copy.
        </p>
      ) : null}
    </WorkspacePageShell>
  );
}
