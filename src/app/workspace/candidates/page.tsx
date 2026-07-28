import { ImportedCandidateBrowser } from "@/components/imported-candidate-browser";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getCandidateDraftConversionReadiness,
  getCandidateWorkflowData
} from "@/lib/candidate-workflow";
import {
  buildPublishedSignalFingerprints,
  evaluateCandidateQuality
} from "@/lib/quality-signals";
import { evaluateImportedCandidatePriority } from "@/lib/ranking";
import { getPublishedTechnologyWorkspaceRecords } from "@/lib/technology-draft-workflow";
import {
  getExternalSourceImportRuns,
  getExternalSources
} from "@/lib/source-workflow";
import { evaluateSourcesQuality } from "@/lib/quality-signals";

export const dynamic = "force-dynamic";

export default function WorkspaceCandidatesPage() {
  const { snapshot, candidates, duplicateGroups } = getCandidateWorkflowData();
  const sources = getExternalSources();
  const sourceIds = sources.map((source) => source.id);
  const sourceQualityById = evaluateSourcesQuality(
    sources,
    candidates,
    getExternalSourceImportRuns()
  );
  const publishedSignals = buildPublishedSignalFingerprints(
    getPublishedTechnologyWorkspaceRecords()
  );
  const candidateQualityById = Object.fromEntries(
    candidates.map((candidate) => {
      const readiness = getCandidateDraftConversionReadiness(candidate.id);

      return [
        candidate.id,
        evaluateCandidateQuality(candidate, {
          canConvert: readiness.canConvert,
          publishedSignals
        })
      ];
    })
  );
  const duplicateGroupById = Object.fromEntries(
    duplicateGroups.map((group) => [group.id, group])
  );
  const candidateRankingById = Object.fromEntries(
    candidates.map((candidate) => {
      const group = candidate.duplicateGroupId
        ? duplicateGroupById[candidate.duplicateGroupId]
        : undefined;
      const sourceQuality = candidate.sourceId
        ? sourceQualityById[candidate.sourceId]
        : undefined;

      return [
        candidate.id,
        evaluateImportedCandidatePriority(candidate, {
          sourceQuality,
          candidateQuality: candidateQualityById[candidate.id],
          duplicateGroupStatus: group?.status,
          additionalReferenceCount:
            group && group.status === "resolved"
              ? Math.max(group.candidateIds.length - 1, 0)
              : 0
        })
      ];
    })
  );

  return (
    <WorkspacePageShell
      title="导入候选"
      description="导入内容的内部审核队列。搜索、筛选、检查重复项，并把有价值的候选转换为技术草稿。"
      sectionLabel="候选池"
    >
      <ImportedCandidateBrowser
        candidates={candidates}
        sourceIds={sourceIds}
        syncedAt={snapshot.syncedAt}
        sourceCount={sources.length}
        candidateQualityById={candidateQualityById}
        candidateRankingById={candidateRankingById}
      />
    </WorkspacePageShell>
  );
}
