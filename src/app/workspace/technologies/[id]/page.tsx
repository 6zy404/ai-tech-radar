import { notFound } from "next/navigation";

import { TechnologyDraftDetailContent } from "@/components/technology-draft-detail-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getTechnologyWorkspaceRecordById
} from "@/lib/content";
import { getTechnologyWorkspacePublishReadiness } from "@/lib/technology-draft-workflow";
import { getEditorialEnrichmentSuggestionsForDraft } from "@/lib/editorial-enrichment-store";
import { getWorkflowEventsForEntity } from "@/lib/workflow-events";

interface WorkspaceTechnologyDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceTechnologyDetailPage({
  params
}: WorkspaceTechnologyDetailPageProps) {
  const { id } = await params;
  const record = getTechnologyWorkspaceRecordById(id);

  if (!record) {
    notFound();
  }

  return (
    <WorkspacePageShell
      title="Technology Workspace Detail"
      description="Inspect an internal technology record, preserve source traceability, and decide whether it stays draft, published, or archived."
      sectionLabel="Draft Review"
    >
      <TechnologyDraftDetailContent
        draft={record}
        tagOptions={getAllTags()}
        skillOptions={getAllSkills()}
        knowledgeOptions={getAllKnowledge()}
        readiness={getTechnologyWorkspacePublishReadiness(record.id)}
        enrichmentSuggestions={getEditorialEnrichmentSuggestionsForDraft(record.id)}
        workflowEvents={getWorkflowEventsForEntity(
          "technology_draft",
          record.id
        )}
      />
    </WorkspacePageShell>
  );
}
