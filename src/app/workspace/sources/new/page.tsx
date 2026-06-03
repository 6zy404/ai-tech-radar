import Link from "next/link";

import { ExternalSourceForm } from "@/components/external-source-form";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const dynamic = "force-dynamic";

export default function NewWorkspaceSourcePage() {
  return (
    <WorkspacePageShell
      title="Add External Source"
      description="Create a local source configuration for importing external technology updates into the internal candidate pool."
      sectionLabel="Source Control"
      actions={
        <Link href="/workspace/sources" className="action-link">
          Back to sources
        </Link>
      }
    >
      <section className="section-panel">
        <ExternalSourceForm />
      </section>
    </WorkspacePageShell>
  );
}
