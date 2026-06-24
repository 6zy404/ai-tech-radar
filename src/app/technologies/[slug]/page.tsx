import { notFound } from "next/navigation";

import { TechnologyDetailContent } from "@/components/technology-detail-content";
import { UserPageShell } from "@/components/user-page-shell";
import {
  buildRelationItems,
  getTagsByIds,
  getTechnologyBySlug
} from "@/lib/content";

interface TechnologyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function TechnologyDetailPage({
  params
}: TechnologyDetailPageProps) {
  const { slug } = await params;
  const technology = getTechnologyBySlug(slug);

  if (!technology) {
    notFound();
  }

  const relatedSkills = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "skill",
    targetIds: technology.relatedSkillIds,
    defaultNote: "这项技能有助于评估技术信号或据此采取行动。"
  });
  const relatedKnowledge = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "knowledge",
    targetIds: technology.relatedKnowledgeIds,
    defaultNote: "这条知识为理解该技术信号提供背景。"
  });
  const relatedTechnologies = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "technology",
    targetIds: technology.relatedTechnologyIds ?? [],
    defaultNote: "与该信号相邻的技术，可顺着这条线继续了解。"
  });

  return (
    <UserPageShell
      title="技术详情"
      description="以阅读为先，呈现已发布信号、来源，以及解释它的技能与知识。"
      sectionLabel="已发布技术"
      showHeader={false}
    >
      <TechnologyDetailContent
        technology={technology}
        tags={getTagsByIds(technology.tags)}
        relatedTechnologies={relatedTechnologies}
        relatedSkills={relatedSkills}
        relatedKnowledge={relatedKnowledge}
      />
    </UserPageShell>
  );
}
