import Link from "next/link";
import { notFound } from "next/navigation";

import { ExternalSourceDetailContent } from "@/components/external-source-detail-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";
import { evaluateSourceQuality } from "@/lib/quality-signals";
import {
  getExternalSourceById,
  getExternalSourceImportRuns,
  getImportedCandidatesForExternalSource
} from "@/lib/source-workflow";

interface WorkspaceSourceDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceSourceDetailPage({
  params
}: WorkspaceSourceDetailPageProps) {
  const { id } = await params;
  const source = getExternalSourceById(id);

  if (!source) {
    notFound();
  }

  const candidates = getImportedCandidatesForExternalSource(source.id);
  const { candidates: allCandidates } = getCandidateWorkflowData();
  const quality = evaluateSourceQuality(
    source,
    allCandidates,
    getExternalSourceImportRuns()
  );

  return (
    <WorkspacePageShell
      title="External Source Detail"
      description="Inspect source configuration, latest import status, and candidates generated from this source."
      sectionLabel="Source Control"
      actions={
        <Link href="/workspace/sources" className="action-link">
          Back to sources
        </Link>
      }
    >
      <ExternalSourceDetailContent
        source={source}
        candidates={candidates}
        quality={quality}
      />
    </WorkspacePageShell>
  );
}
