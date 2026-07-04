import Link from "next/link";

import { ExternalSourceBrowser } from "@/components/external-source-browser";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";
import { evaluateSourcesQuality } from "@/lib/quality-signals";
import {
  getExternalSourceImportRuns,
  getExternalSources,
  getLatestExternalSourceImportRun
} from "@/lib/source-workflow";

export const dynamic = "force-dynamic";

export default function WorkspaceSourcesPage() {
  const sources = getExternalSources();
  const latestImportRun = getLatestExternalSourceImportRun();
  const importRuns = getExternalSourceImportRuns();
  const { candidates } = getCandidateWorkflowData();
  const sourceQualityById = evaluateSourcesQuality(
    sources,
    candidates,
    importRuns
  );

  return (
    <WorkspacePageShell
      title="Sources"
      description="Manage external sources and monitor import health."
      sectionLabel="Source Control"
      className="workspace-delivery-console workspace-sources-console"
      securityNote={
        <>
          <strong>Internal workspace.</strong> Source imports create candidates.
          Review imported items before publishing.
        </>
      }
      actions={
        <Link
          href="/workspace/sources/new"
          className="action-button action-button--accent"
        >
          Add source
        </Link>
      }
    >
      <ExternalSourceBrowser
        sources={sources}
        latestImportRun={latestImportRun}
        sourceQualityById={sourceQualityById}
      />
    </WorkspacePageShell>
  );
}
