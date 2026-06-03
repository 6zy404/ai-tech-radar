import Link from "next/link";

import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type { KnowledgeItem, TechnologyItem } from "@/types/content";

const difficultySections = [
  {
    id: "foundation",
    title: "Foundation concepts",
    description: "Start here when a technology page uses unfamiliar terms."
  },
  {
    id: "intermediate",
    title: "Intermediate patterns",
    description: "Use these concepts to compare approaches and tradeoffs."
  },
  {
    id: "advanced",
    title: "Advanced context",
    description: "Deeper background for technical strategy and system design."
  }
];

function getRelatedTechnologies(
  item: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );
}

export default function KnowledgePage() {
  const knowledgeItems = getAllKnowledge();
  const technologies = getAllTechnologies();
  const skills = getAllSkills();
  const foundationCount = knowledgeItems.filter(
    (item) => item.difficulty === "foundation"
  ).length;
  const groupedKnowledge = difficultySections
    .map((section) => ({
      ...section,
      items: knowledgeItems.filter((item) => item.difficulty === section.id)
    }))
    .filter((section) => section.items.length > 0);

  return (
    <UserPageShell
      title="Knowledge for Reading AI Signals"
      description="Durable concepts that explain why new AI technologies matter and which older ideas still shape them."
      sectionLabel="Background Knowledge"
    >
      <section className="foundation-intro-panel">
        <div>
          <p className="eyebrow user-eyebrow">Concept map</p>
          <h2>Knowledge turns fast-moving signals into understandable patterns.</h2>
          <p>
            Use this page when a technology page references a concept you need to
            refresh. Each knowledge item shows why it is foundational and which
            published technology signals depend on it.
          </p>
        </div>
        <div className="foundation-intro-panel__stats">
          <strong>{knowledgeItems.length}</strong>
          <span>knowledge concepts</span>
          <strong>{foundationCount}</strong>
          <span>foundation-level entries</span>
          <strong>{skills.length}</strong>
          <span>skills connected</span>
        </div>
      </section>

      <div className="foundation-group-stack">
        {groupedKnowledge.map((section) => (
          <section key={section.id} className="foundation-group">
            <div className="foundation-group__header">
              <div>
                <p className="eyebrow user-eyebrow">{section.id}</p>
                <h2>{section.title}</h2>
              </div>
              <p>{section.description}</p>
            </div>
            <div className="foundation-index-grid">
              {section.items.map((item) => {
                const relatedTechnologies = getRelatedTechnologies(
                  item,
                  technologies
                );
                const relatedTechnologyPreview = relatedTechnologies.slice(0, 2);

                return (
                  <article key={item.id} className="foundation-index-card">
                    <div className="foundation-index-card__meta">
                      <span>{item.category}</span>
                      <span>{item.relatedSkillIds.length} related skills</span>
                    </div>
                    <h2>
                      <Link href={`/knowledge/${item.slug}`}>{item.title}</Link>
                    </h2>
                    <p>{item.summary}</p>
                    <div className="foundation-index-card__section">
                      <span>Explains signals such as</span>
                      {relatedTechnologyPreview.length > 0 ? (
                        <ul>
                          {relatedTechnologyPreview.map((technology) => (
                            <li key={technology.id}>
                              <Link href={`/technologies/${technology.slug}`}>
                                {getPreferredTechnologyTitle(technology)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No published technology links yet.</p>
                      )}
                    </div>
                    <TagList tags={getTagsByIds(item.tags)} limit={3} />
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </UserPageShell>
  );
}
