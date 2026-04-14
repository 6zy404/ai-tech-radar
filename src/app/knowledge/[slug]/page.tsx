import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RelationList } from "@/components/relation-list";
import { TagBadge } from "@/components/tag-badge";
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
    targetType: "technology",
    targetIds: knowledge.relatedTechnologyIds,
    defaultNote: "This technology record links back to the concept in the mock data model."
  });

  const relatedSkills = buildRelationItems({
    targetType: "skill",
    targetIds: knowledge.relatedSkillIds,
    defaultNote: "This skill benefits from understanding the classic concept first."
  });

  return (
    <PageShell title={knowledge.title} description={knowledge.summary}>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-panel">
            <p className="eyebrow">{knowledge.category}</p>
            <h1>{knowledge.title}</h1>
            <p>{knowledge.content}</p>
            <div className="tag-row">
              {getTagsByIds(knowledge.tags).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          </section>

          <RelationList
            title="Linked Technologies"
            emptyText="No technologies reference this knowledge item yet."
            items={relatedTechnologies}
          />

          <RelationList
            title="Linked Skills"
            emptyText="No skills reference this knowledge item yet."
            items={relatedSkills}
          />
        </div>

        <aside className="detail-side">
          <section className="detail-panel">
            <h2>Knowledge profile</h2>
            <div className="detail-meta">
              <span>Difficulty: {knowledge.difficulty}</span>
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
