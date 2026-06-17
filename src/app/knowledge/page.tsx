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
import type {
  DifficultyLevel,
  KnowledgeCategory,
  KnowledgeItem,
  SkillItem,
  TechnologyItem
} from "@/types/content";

const difficultySections: Array<{
  id: DifficultyLevel;
  title: string;
  description: string;
}> = [
  {
    id: "foundation",
    title: "Foundation concepts",
    description:
      "Start here when a technology signal uses unfamiliar terms or older technical ideas."
  },
  {
    id: "intermediate",
    title: "Intermediate patterns",
    description:
      "Use these concepts to compare approaches, tradeoffs, and implementation paths."
  },
  {
    id: "advanced",
    title: "Advanced context",
    description:
      "Use this context when a signal changes architecture, data, or technical strategy assumptions."
  }
];

const categoryLabels: Record<KnowledgeCategory, string> = {
  "machine-learning": "Machine learning",
  "software-architecture": "Software architecture",
  data: "Data",
  "product-thinking": "Product thinking",
  operations: "Operations"
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "Foundation",
  intermediate: "Intermediate",
  advanced: "Advanced"
};

function getRelatedTechnologies(
  item: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedSkillCount(item: KnowledgeItem, skills: SkillItem[]): number {
  return skills.filter((skill) => item.relatedSkillIds.includes(skill.id))
    .length;
}

function getKnowledgeOutcome(item: KnowledgeItem): string {
  const categoryOutcomes: Record<KnowledgeCategory, string> = {
    "machine-learning":
      "Helps you judge model behavior, evaluation limits, and practical constraints.",
    "software-architecture":
      "Helps you recognize interface boundaries, system tradeoffs, and integration risks.",
    data: "Helps you understand retrieval, freshness, trust, and data-flow assumptions.",
    "product-thinking":
      "Helps you turn technical changes into scoped product and adoption decisions.",
    operations:
      "Helps you reason about review loops, observability, and rollout discipline."
  };

  return categoryOutcomes[item.category];
}

export default function KnowledgePage() {
  const knowledgeItems = getAllKnowledge();
  const technologies = getAllTechnologies();
  const skills = getAllSkills();
  const foundationCount = knowledgeItems.filter(
    (item) => item.difficulty === "foundation"
  ).length;
  const relatedSkillCount = new Set(
    knowledgeItems.flatMap((item) => item.relatedSkillIds)
  ).size;
  const relatedTechnologyCount = new Set(
    knowledgeItems.flatMap((item) => item.relatedTechnologyIds)
  ).size;
  const groupedKnowledge = difficultySections
    .map((section) => ({
      ...section,
      items: knowledgeItems.filter((item) => item.difficulty === section.id)
    }))
    .filter((section) => section.items.length > 0);

  return (
    <UserPageShell
      title="Knowledge for Reading AI Signals"
      description="Concepts that help users understand AI technology signals and their context."
      sectionLabel="Background Knowledge"
      className="skills-library-page knowledge-library-page"
    >
      {knowledgeItems.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">No concepts yet</p>
          <h2>No knowledge concepts yet.</h2>
          <p>
            Published background concepts will appear here once the learning
            library is populated.
          </p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div>
              <p className="eyebrow user-eyebrow">Concept map</p>
              <h2>
                Knowledge turns fast-moving signals into understandable
                patterns.
              </h2>
              <p>
                Use this page when a technology signal references a concept you
                need to refresh. Each concept explains what it clarifies and
                which published signals depend on it.
              </p>
            </div>
            <div className="skills-library-intro__stats">
              <strong>{knowledgeItems.length}</strong>
              <span>knowledge concepts</span>
              <strong>{foundationCount}</strong>
              <span>foundation-level entries</span>
              <strong>{relatedSkillCount}</strong>
              <span>skills connected</span>
              <strong>{relatedTechnologyCount}</strong>
              <span>published signals linked</span>
            </div>
          </section>

          <section className="skills-library-guide" aria-label="Reading path">
            <article>
              <span>1</span>
              <h2>Start with the concept</h2>
              <p>Refresh the background idea before opening a signal.</p>
            </article>
            <article>
              <span>2</span>
              <h2>Open related signals</h2>
              <p>See where the concept appears in published AI changes.</p>
            </article>
            <article>
              <span>3</span>
              <h2>Pair with skills</h2>
              <p>Use linked skills to evaluate or apply the concept.</p>
            </article>
          </section>

          <div className="skills-library-groups">
            {groupedKnowledge.map((section) => (
              <section key={section.id} className="skills-library-section">
                <div className="skills-library-section__header">
                  <div>
                    <p className="eyebrow user-eyebrow">
                      {difficultyLabels[section.id]}
                    </p>
                    <h2>{section.title}</h2>
                  </div>
                  <p>{section.description}</p>
                </div>
                <div className="skills-library-card-grid">
                  {section.items.map((item) => {
                    const relatedTechnologies = getRelatedTechnologies(
                      item,
                      technologies
                    );
                    const relatedTechnologyPreview = relatedTechnologies.slice(
                      0,
                      2
                    );
                    const relatedSkillTotal = getRelatedSkillCount(item, skills);

                    return (
                      <article
                        key={item.id}
                        className="skill-library-card knowledge-library-card"
                      >
                        <div className="skill-library-card__meta">
                          <span>{categoryLabels[item.category]}</span>
                          <span>{difficultyLabels[item.difficulty]}</span>
                        </div>
                        <h2>
                          <Link href={`/knowledge/${item.slug}`}>
                            {item.title}
                          </Link>
                        </h2>
                        <p>{item.summary}</p>
                        <div className="skill-library-card__outcome">
                          <span>Helps you understand</span>
                          <p>{getKnowledgeOutcome(item)}</p>
                        </div>
                        <div className="skill-library-card__counts">
                          <span>
                            {relatedTechnologies.length} related signal
                            {relatedTechnologies.length === 1 ? "" : "s"}
                          </span>
                          <span>
                            {relatedSkillTotal} related skill
                            {relatedSkillTotal === 1 ? "" : "s"}
                          </span>
                        </div>
                        {relatedTechnologyPreview.length > 0 ? (
                          <div className="skill-library-card__signals">
                            <span>Explains signals such as</span>
                            <ul>
                              {relatedTechnologyPreview.map((technology) => (
                                <li key={technology.id}>
                                  <Link
                                    href={`/technologies/${technology.slug}`}
                                  >
                                    {getPreferredTechnologyTitle(technology)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <TagList tags={getTagsByIds(item.tags)} limit={3} />
                        <Link
                          className="skill-library-card__link"
                          href={`/knowledge/${item.slug}`}
                        >
                          View concept
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </UserPageShell>
  );
}
