import Link from "next/link";

import { TechnologyDraftCard } from "@/components/technology-draft-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getTechnologyWorkspaceRecords } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function WorkspaceTechnologiesPage() {
  const records = getTechnologyWorkspaceRecords();
  const draftRecords = records.filter((record) => record.status === "draft");
  const managedRecords = records.filter((record) => record.status !== "draft");
  const draftCount = records.filter(
    (record) => record.status === "draft"
  ).length;
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
      className="workspace-technologies-console"
      securityNote={
        <>
          <strong>Internal technology console.</strong> Draft edits, status
          changes, source traceability, and preview checks stay in Workspace
          before any public reading surface is opened.
        </>
      }
      actions={
        <Link
          href="/workspace/candidates"
          className="action-button action-button--accent"
        >
          Review candidates
        </Link>
      }
    >
      <section
        className="workspace-status-overview"
        aria-label="Technology status overview"
      >
        <div className="workspace-status-overview__card">
          <span>Draft queue</span>
          <strong>{draftCount}</strong>
          <small>Needs workspace review</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>Published records</span>
          <strong>{publishedCount}</strong>
          <small>Visible in the user product</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>Archived records</span>
          <strong>{archivedCount}</strong>
          <small>Retained for traceability</small>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${records.length} technology workspace records`}
        detail="Drafts are edited here; published and archived records remain visible for internal traceability."
      />

      <section
        className="workspace-technology-section"
        aria-labelledby="technology-draft-queue"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">
              Draft management
            </p>
            <h2 id="technology-draft-queue">Draft technology records</h2>
          </div>
          <span>{draftRecords.length} drafts</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {draftRecords.map((record) => (
            <TechnologyDraftCard key={record.id} draft={record} />
          ))}
        </div>

        {draftRecords.length === 0 ? (
          <section className="empty-state empty-state--actionable">
            <div>
              <strong>No draft technology records.</strong>
              <p>
                Convert an imported candidate into a technology draft before
                editing source context, relationships, and publication
                readiness.
              </p>
            </div>
            <Link href="/workspace/candidates" className="action-link">
              Review candidates to create a draft
            </Link>
          </section>
        ) : null}
      </section>

      <section
        className="workspace-technology-section"
        aria-labelledby="technology-published-archive"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">
              Published archive
            </p>
            <h2 id="technology-published-archive">
              Published and archived records
            </h2>
          </div>
          <span>{managedRecords.length} records</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {managedRecords.map((record) => (
            <TechnologyDraftCard key={record.id} draft={record} />
          ))}
        </div>

        {managedRecords.length === 0 ? (
          <p className="empty-state">
            No published or archived technology records yet. Published records
            will appear here after draft review is complete.
          </p>
        ) : null}
      </section>

      {records.length === 0 ? (
        <p className="workspace-technology-empty-note">
          Technology workspace records are created only through candidate
          conversion; this page does not ingest sources or rank technologies.
        </p>
      ) : null}
    </WorkspacePageShell>
  );
}
