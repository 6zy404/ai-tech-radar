import { notFound } from "next/navigation";

import { TechnologyDraftDetailContent } from "@/components/technology-draft-detail-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies,
  getTechnologyWorkspaceRecordById
} from "@/lib/content";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import { getTechnologyWorkspacePublishReadiness } from "@/lib/technology-draft-workflow";
import { getEditorialEnrichmentSuggestionsForDraft } from "@/lib/editorial-enrichment-store";
import { buildRelationDefaults } from "@/lib/link-relation-workflow";
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

  const skillOptions = getAllSkills();
  const knowledgeOptions = getAllKnowledge();
  // Only published technologies can be linked: a link to an unpublished draft
  // would render as a dead node on /network and the detail-page graph.
  const technologyOptions = getAllTechnologies()
    .filter((item) => item.id !== record.id)
    .map((item) => ({
      id: item.id,
      title: getPreferredTechnologyTitle(item)
    }));
  const relationDefaults = buildRelationDefaults(
    { id: record.id, type: "technology" },
    [
      ...knowledgeOptions.map((item) => ({
        id: item.id,
        type: "knowledge" as const
      })),
      ...skillOptions.map((item) => ({ id: item.id, type: "skill" as const })),
      ...technologyOptions.map((item) => ({
        id: item.id,
        type: "technology" as const
      }))
    ]
  );

  return (
    <WorkspacePageShell
      title="技术工作台详情"
      description="查看内部技术记录、保留来源溯源，并决定它保持草稿、发布还是归档。"
      sectionLabel="草稿审核"
    >
      <TechnologyDraftDetailContent
        draft={record}
        tagOptions={getAllTags()}
        skillOptions={skillOptions}
        knowledgeOptions={knowledgeOptions}
        technologyOptions={technologyOptions}
        relationDefaults={relationDefaults}
        readiness={getTechnologyWorkspacePublishReadiness(record.id)}
        enrichmentSuggestions={getEditorialEnrichmentSuggestionsForDraft(
          record.id
        )}
        workflowEvents={getWorkflowEventsForEntity(
          "technology_draft",
          record.id
        )}
      />
    </WorkspacePageShell>
  );
}
