import { ImportedCandidateBrowser } from "@/components/imported-candidate-browser";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getCandidateDraftConversionReadiness,
  getCandidateWorkflowData
} from "@/lib/candidate-workflow";
import { evaluateCandidateQuality } from "@/lib/quality-signals";
import { evaluateImportedCandidatePriority } from "@/lib/ranking";
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
  const candidateQualityById = Object.fromEntries(
    candidates.map((candidate) => {
      const readiness = getCandidateDraftConversionReadiness(candidate.id);

      return [
        candidate.id,
        evaluateCandidateQuality(candidate, {
          canConvert: readiness.canConvert
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
      title="Imported Candidates"
      description="Internal review queue for imported source items. Search, filter, inspect duplicates, and convert promising candidates into technology drafts."
      sectionLabel="Candidate Pool"
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
