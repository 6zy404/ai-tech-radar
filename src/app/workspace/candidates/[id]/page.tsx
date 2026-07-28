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
  buildPublishedSignalFingerprints,
  evaluateCandidateQuality,
  evaluateSourceQuality
} from "@/lib/quality-signals";
import { evaluateImportedCandidatePriority } from "@/lib/ranking";
import { getPublishedTechnologyWorkspaceRecords } from "@/lib/technology-draft-workflow";
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
    canConvert: getCandidateDraftConversionReadiness(candidate.id).canConvert,
    publishedSignals: buildPublishedSignalFingerprints(
      getPublishedTechnologyWorkspaceRecords()
    )
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
      title="导入候选详情"
      description="导入候选的内部审核详情。查看原始内容、重复提示、来源溯源与转换状态。"
      sectionLabel="候选审核"
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
