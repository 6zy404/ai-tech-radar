import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RelationList } from "@/components/relation-list";
import { TagBadge } from "@/components/tag-badge";
import {
  buildRelationItems,
  getAllSkills,
  getSkillBySlug,
  getTagsByIds
} from "@/lib/content";

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSkills().map((item) => ({ slug: item.slug }));
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  const relatedTechnologies = buildRelationItems({
    targetType: "technology",
    targetIds: skill.relatedTechnologyIds,
    defaultNote: "Linked directly from the mock skill record to show where this skill is applied."
  });

  const relatedKnowledge = buildRelationItems({
    targetType: "knowledge",
    targetIds: skill.relatedKnowledgeIds,
    defaultNote: "This knowledge item supports the skill in the mock dataset."
  });

  return (
    <PageShell title={skill.title} description={skill.summary}>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-panel">
            <p className="eyebrow">{skill.skillType}</p>
            <h1>{skill.title}</h1>
            <p>{skill.content}</p>
            <div className="tag-row">
              {getTagsByIds(skill.tags).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          </section>

          <RelationList
            title="Related Technologies"
            emptyText="No related technologies were linked for this skill."
            items={relatedTechnologies}
          />

          <RelationList
            title="Related Knowledge"
            emptyText="No related knowledge was linked for this skill."
            items={relatedKnowledge}
          />
        </div>

        <aside className="detail-side">
          <section className="detail-panel">
            <h2>Skill profile</h2>
            <div className="detail-meta">
              <span>Heat: {skill.heatLevel}</span>
              <span>Learning cost: {skill.learningCost}</span>
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
