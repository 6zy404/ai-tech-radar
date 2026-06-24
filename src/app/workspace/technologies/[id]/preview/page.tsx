import Link from "next/link";
import { notFound } from "next/navigation";

import { TechnologyDetailContent } from "@/components/technology-detail-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  buildRelationItems,
  getTagsByIds,
  getTechnologyWorkspaceRecordById,
  toUserFacingTechnologyItem
} from "@/lib/content";

interface WorkspaceTechnologyPreviewPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceTechnologyPreviewPage({
  params
}: WorkspaceTechnologyPreviewPageProps) {
  const { id } = await params;
  const record = getTechnologyWorkspaceRecordById(id);

  if (!record) {
    notFound();
  }

  const technology = toUserFacingTechnologyItem(record);
  const relatedSkills = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "skill",
    targetIds: technology.relatedSkillIds,
    defaultNote: "This skill is linked directly from the technology record."
  });
  const relatedKnowledge = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "knowledge",
    targetIds: technology.relatedKnowledgeIds,
    defaultNote: "This knowledge item gives background for the technology signal."
  });
  const relatedTechnologies = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "technology",
    targetIds: technology.relatedTechnologyIds ?? [],
    defaultNote: "This technology is linked from the technology record."
  });

  return (
    <WorkspacePageShell
      title="Technology Preview"
      description="Preview the draft with the same user-facing technology detail renderer before publishing."
      sectionLabel="Publish Preview"
      actions={
        <Link href={`/workspace/technologies/${record.id}`} className="action-link">
          Back to workspace record
        </Link>
      }
    >
      <TechnologyDetailContent
        technology={technology}
        tags={getTagsByIds(technology.tags)}
        relatedTechnologies={relatedTechnologies}
        relatedSkills={relatedSkills}
        relatedKnowledge={relatedKnowledge}
      />
    </WorkspacePageShell>
  );
}
