import { notFound } from "next/navigation";

import { TechnologyDetailContent } from "@/components/technology-detail-content";
import { UserPageShell } from "@/components/user-page-shell";
import {
  buildRelationItems,
  getAllTechnologies,
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
    defaultNote: "This skill helps evaluate or act on the technology signal."
  });
  const relatedKnowledge = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "knowledge",
    targetIds: technology.relatedKnowledgeIds,
    defaultNote: "This knowledge item gives background for understanding the signal."
  });

  return (
    <UserPageShell
      title="Technology Detail"
      description="A reading-first view of the published signal, its source, and the skills and knowledge that explain it."
      sectionLabel="Published Technology"
      showHeader={false}
    >
      <TechnologyDetailContent
        technology={technology}
        tags={getTagsByIds(technology.tags)}
        relatedSkills={relatedSkills}
        relatedKnowledge={relatedKnowledge}
      />
    </UserPageShell>
  );
}
