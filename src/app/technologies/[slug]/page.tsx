import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RelationList } from "@/components/relation-list";
import { TagBadge } from "@/components/tag-badge";
import {
  buildRelationItems,
  getAllTechnologies,
  getTagsByIds,
  getTechnologyBySlug
} from "@/lib/content";

interface TechnologyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllTechnologies().map((item) => ({ slug: item.slug }));
}

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
    defaultNote: "This skill is linked directly from the technology record."
  });
  const relatedKnowledge = buildRelationItems({
    fromId: technology.id,
    fromType: "technology",
    targetType: "knowledge",
    targetIds: technology.relatedKnowledgeIds,
    defaultNote: "This knowledge item gives background for the technology signal."
  });

  return (
    <PageShell
      title="Technology Detail"
      description="Each mock technology page connects one signal to the skills and classic knowledge that explain it."
    >
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-panel">
            <p className="eyebrow">{technology.type}</p>
            <h1>{technology.title}</h1>
            <p>{technology.summary}</p>
            <div className="tag-row">
              {getTagsByIds(technology.tags).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          </section>

          <section className="detail-section section-panel">
            <h2>Why it matters in this prototype</h2>
            <p>{technology.content}</p>
          </section>

          <RelationList
            title="Related Skills"
            emptyText="No related skills were linked for this item."
            items={relatedSkills}
          />

          <RelationList
            title="Related Knowledge"
            emptyText="No related knowledge was linked for this item."
            items={relatedKnowledge}
          />
        </div>

        <aside className="detail-side">
          <section className="detail-panel">
            <h2>Source</h2>
            <div className="detail-meta">
              <span>{technology.sourceName}</span>
              <a href={technology.sourceUrl} target="_blank" rel="noreferrer">
                {technology.sourceUrl}
              </a>
            </div>
          </section>

          <section className="detail-panel">
            <h2>Publisher</h2>
            <div className="detail-meta">
              <span>{technology.publisherName}</span>
              <span>{technology.publisherType}</span>
              <span>Published {technology.publishDate}</span>
              <span>Importance: {technology.importanceLevel}</span>
              <span>Status: {technology.status}</span>
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
