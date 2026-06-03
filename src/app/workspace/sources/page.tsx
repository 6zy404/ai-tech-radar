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
      title="External Sources"
      description="Internal source management for configuring external feeds and manually importing content into the candidate pool."
      sectionLabel="Source Control"
      actions={
        <Link href="/workspace/sources/new" className="action-link">
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
