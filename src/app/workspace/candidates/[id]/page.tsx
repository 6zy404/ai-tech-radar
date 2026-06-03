import { notFound } from "next/navigation";

import { ImportedCandidateDetailContent } from "@/components/imported-candidate-detail-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getDuplicateComparisonsForCandidate,
  getCandidateDraftConversionReadiness,
  getCandidateWorkflowData,
  getImportedCandidateById
} from "@/lib/candidate-workflow";
import {
  evaluateCandidateQuality,
  evaluateSourceQuality
} from "@/lib/quality-signals";
import { evaluateImportedCandidatePriority } from "@/lib/ranking";
import {
  getExternalSourceById,
  getExternalSourceImportRuns
} from "@/lib/source-workflow";
import { getWorkflowEventsForEntity } from "@/lib/workflow-events";

interface WorkspaceCandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceCandidateDetailPage({
  params
}: WorkspaceCandidateDetailPageProps) {
  const { id } = await params;
  const candidate = getImportedCandidateById(id);
  const duplicateComparisons = getDuplicateComparisonsForCandidate(id);
  const source = candidate?.sourceId
    ? getExternalSourceById(candidate.sourceId)
    : undefined;
  const { candidates, duplicateGroups } = getCandidateWorkflowData();

  if (!candidate) {
    notFound();
  }

  const candidateQuality = evaluateCandidateQuality(candidate, {
    canConvert: getCandidateDraftConversionReadiness(candidate.id).canConvert
  });
  const duplicateGroup = candidate.duplicateGroupId
    ? duplicateGroups.find((group) => group.id === candidate.duplicateGroupId)
    : undefined;
  const ranking = evaluateImportedCandidatePriority(candidate, {
    sourceQuality: source
      ? evaluateSourceQuality(source, candidates, getExternalSourceImportRuns())
      : undefined,
    candidateQuality,
    duplicateGroupStatus: duplicateGroup?.status,
    additionalReferenceCount:
      duplicateGroup && duplicateGroup.status === "resolved"
        ? Math.max(duplicateGroup.candidateIds.length - 1, 0)
        : 0
  });

  return (
    <WorkspacePageShell
      title="Imported Candidate Detail"
      description="Internal review detail for an imported candidate. Inspect original content, duplicate hints, source traceability, and conversion state."
      sectionLabel="Candidate Review"
    >
      <ImportedCandidateDetailContent
        candidate={candidate}
        duplicateComparisons={duplicateComparisons}
        source={source}
        ranking={ranking}
        workflowEvents={getWorkflowEventsForEntity("candidate", candidate.id)}
      />
    </WorkspacePageShell>
  );
}
