import { notFound } from "next/navigation";

import { DuplicateGroupDetailContent } from "@/components/duplicate-group-detail-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getDuplicateComparisonsForCandidate,
  getDuplicateGroupById,
  getDuplicateGroupCandidates
} from "@/lib/candidate-workflow";
import type { DuplicateReason } from "@/types/content";

interface WorkspaceDuplicateDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceDuplicateDetailPage({
  params
}: WorkspaceDuplicateDetailPageProps) {
  const { id } = await params;
  const group = getDuplicateGroupById(id);

  if (!group) {
    notFound();
  }

  const candidates = getDuplicateGroupCandidates(group.id);
  const reasonsByCandidateId: Record<string, DuplicateReason[]> = {};

  for (const candidate of candidates) {
    reasonsByCandidateId[candidate.id] = Array.from(
      new Set(
        getDuplicateComparisonsForCandidate(candidate.id)
          .filter((comparison) =>
            group.candidateIds.includes(comparison.candidate.id)
          )
          .flatMap((comparison) => comparison.reasons)
      )
    );
  }

  return (
    <WorkspacePageShell
      title="Duplicate Group Detail"
      description="Internal comparison view for selecting a primary imported candidate and preventing duplicate technology drafts."
      sectionLabel="Candidate Deduplication"
    >
      <DuplicateGroupDetailContent
        group={group}
        candidates={candidates}
        reasonsByCandidateId={reasonsByCandidateId}
      />
    </WorkspacePageShell>
  );
}
