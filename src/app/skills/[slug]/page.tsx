import { notFound } from "next/navigation";

import { RelationList } from "@/components/relation-list";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
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
    fromId: skill.id,
    fromType: "skill",
    targetType: "technology",
    targetIds: skill.relatedTechnologyIds,
    defaultNote: "This published signal is easier to assess with this skill."
  });

  const relatedKnowledge = buildRelationItems({
    fromId: skill.id,
    fromType: "skill",
    targetType: "knowledge",
    targetIds: skill.relatedKnowledgeIds,
    defaultNote: "This concept gives the background needed to use the skill well."
  });

  return (
    <UserPageShell
      title={skill.title}
      description={skill.summary}
      sectionLabel="Understanding Skill"
      showHeader={false}
    >
      <div className="foundation-detail-layout">
        <main className="foundation-detail-main">
          <section className="foundation-detail-hero">
            <p className="eyebrow user-eyebrow">{skill.skillType}</p>
            <h1>{skill.title}</h1>
            <p>{skill.summary}</p>
            <TagList tags={getTagsByIds(skill.tags)} />
          </section>

          <section className="user-article-section">
            <h2>What this skill helps you do</h2>
            <p>{skill.content}</p>
          </section>

          <RelationList
            className="user-related-section"
            title="Technology signals this skill helps evaluate"
            description="Use these published signals as concrete examples for practicing the skill."
            emptyText="No published technology signals are linked to this skill yet."
            items={relatedTechnologies}
          />

          <RelationList
            className="user-related-section"
            title="Background knowledge to pair with this skill"
            description="These concepts make the skill easier to apply when reading new AI technology signals."
            emptyText="No background knowledge has been linked to this skill yet."
            items={relatedKnowledge}
          />
        </main>

        <aside className="foundation-detail-side">
          <section className="user-reference-panel">
            <h2>Skill profile</h2>
            <dl className="foundation-profile-list">
              <div>
                <dt>Current heat</dt>
                <dd>{skill.heatLevel}</dd>
              </div>
              <div>
                <dt>Learning cost</dt>
                <dd>{skill.learningCost}</dd>
              </div>
              <div>
                <dt>Technology links</dt>
                <dd>{relatedTechnologies.length}</dd>
              </div>
              <div>
                <dt>Knowledge links</dt>
                <dd>{relatedKnowledge.length}</dd>
              </div>
            </dl>
          </section>

          <section className="user-reference-panel">
            <h2>How to use this page</h2>
            <p className="user-reference-panel__copy">
              Start with the skill explanation, open one linked technology
              signal, then use the background knowledge links to fill in the
              concepts behind the signal.
            </p>
          </section>
        </aside>
      </div>
    </UserPageShell>
  );
}
