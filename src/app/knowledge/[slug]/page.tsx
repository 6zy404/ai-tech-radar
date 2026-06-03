import { notFound } from "next/navigation";

import { RelationList } from "@/components/relation-list";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  buildRelationItems,
  getAllKnowledge,
  getKnowledgeBySlug,
  getTagsByIds
} from "@/lib/content";

interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllKnowledge().map((item) => ({ slug: item.slug }));
}

export default async function KnowledgeDetailPage({
  params
}: KnowledgeDetailPageProps) {
  const { slug } = await params;
  const knowledge = getKnowledgeBySlug(slug);

  if (!knowledge) {
    notFound();
  }

  const relatedTechnologies = buildRelationItems({
    fromId: knowledge.id,
    fromType: "knowledge",
    targetType: "technology",
    targetIds: knowledge.relatedTechnologyIds,
    defaultNote: "This published signal depends on this background concept."
  });

  const relatedSkills = buildRelationItems({
    fromId: knowledge.id,
    fromType: "knowledge",
    targetType: "skill",
    targetIds: knowledge.relatedSkillIds,
    defaultNote: "This skill becomes easier to practice with this concept."
  });

  return (
    <UserPageShell
      title={knowledge.title}
      description={knowledge.summary}
      sectionLabel="Background Knowledge"
      showHeader={false}
    >
      <div className="foundation-detail-layout">
        <main className="foundation-detail-main">
          <section className="foundation-detail-hero">
            <p className="eyebrow user-eyebrow">{knowledge.category}</p>
            <h1>{knowledge.title}</h1>
            <p>{knowledge.summary}</p>
            <TagList tags={getTagsByIds(knowledge.tags)} />
          </section>

          <section className="user-article-section">
            <h2>Why this concept is foundational</h2>
            <p>{knowledge.content}</p>
          </section>

          <RelationList
            className="user-related-section"
            title="Technology signals explained by this concept"
            description="These published signals are easier to understand when this concept is clear."
            emptyText="No published technology signals reference this concept yet."
            items={relatedTechnologies}
          />

          <RelationList
            className="user-related-section"
            title="Skills that use this concept"
            description="These practical skills depend on the background model described here."
            emptyText="No skills are linked to this concept yet."
            items={relatedSkills}
          />
        </main>

        <aside className="foundation-detail-side">
          <section className="user-reference-panel">
            <h2>Knowledge profile</h2>
            <dl className="foundation-profile-list">
              <div>
                <dt>Category</dt>
                <dd>{knowledge.category}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd>{knowledge.difficulty}</dd>
              </div>
              <div>
                <dt>Technology links</dt>
                <dd>{relatedTechnologies.length}</dd>
              </div>
              <div>
                <dt>Skill links</dt>
                <dd>{relatedSkills.length}</dd>
              </div>
            </dl>
          </section>

          <section className="user-reference-panel">
            <h2>How to use this page</h2>
            <p className="user-reference-panel__copy">
              Read the concept first, then open the linked technology signals
              to see how the concept appears in newer AI product and
              engineering changes.
            </p>
          </section>
        </aside>
      </div>
    </UserPageShell>
  );
}
