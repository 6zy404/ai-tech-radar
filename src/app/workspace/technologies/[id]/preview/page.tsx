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
    defaultNote:
      "This knowledge item gives background for the technology signal."
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
      title="技术预览"
      description="发布前用与用户端相同的技术详情渲染器预览草稿。"
      sectionLabel="发布预览"
      actions={
        <Link
          href={`/workspace/technologies/${record.id}`}
          className="action-link"
        >
          返回工作台记录
        </Link>
      }
    >
      <TechnologyDetailContent
        technology={technology}
        tags={getTagsByIds(technology.tags)}
        relatedTechnologies={relatedTechnologies}
        relatedSkills={relatedSkills}
        relatedKnowledge={relatedKnowledge}
        compareCandidates={[]}
      />
    </WorkspacePageShell>
  );
}
