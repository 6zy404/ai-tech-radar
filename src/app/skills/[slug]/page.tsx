import Link from "next/link";
import { notFound } from "next/navigation";

import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getSkillBySlug,
  getTagsByIds
} from "@/lib/content";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type {
  HeatLevel,
  KnowledgeItem,
  LearningCost,
  SkillItem,
  SkillType,
  TechnologyItem
} from "@/types/content";

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

const skillTypeLabels: Record<SkillType, string> = {
  engineering: "Engineering execution",
  analysis: "Evaluation and analysis",
  product: "Product judgement",
  operations: "Operations and adoption",
  communication: "Team communication"
};

const heatLabels: Record<HeatLevel, string> = {
  hot: "Hot now",
  active: "Active",
  emerging: "Emerging"
};

const learningCostLabels: Record<LearningCost, string> = {
  low: "Low learning cost",
  medium: "Medium learning cost",
  high: "High learning cost"
};

export function generateStaticParams() {
  return getAllSkills().map((item) => ({ slug: item.slug }));
}

function getRelatedTechnologies(
  skill: SkillItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    skill.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedKnowledge(
  skill: SkillItem,
  knowledgeItems: KnowledgeItem[]
): KnowledgeItem[] {
  return knowledgeItems.filter((knowledge) =>
    skill.relatedKnowledgeIds.includes(knowledge.id)
  );
}

function getSkillSignalExplanation(skill: SkillItem): string {
  switch (skill.skillType) {
    case "engineering":
      return "Use this skill to judge whether the signal can become a maintainable product or engineering capability.";
    case "analysis":
      return "Use this skill to inspect evidence, failure modes, and whether the signal deserves a real test.";
    case "product":
      return "Use this skill to decide whether the signal should become a product bet, a small experiment, or a watch item.";
    case "operations":
      return "Use this skill to understand rollout, observability, and reliability implications before adoption.";
    case "communication":
      return "Use this skill to explain the signal clearly enough for cross-functional decisions.";
    default:
      return "Use this skill to read the signal with more context and less guesswork.";
  }
}

function getSkillUseSteps(skill: SkillItem): string[] {
  return [
    `Start with the ${skillTypeLabels[skill.skillType].toLowerCase()} lens and read the short explanation.`,
    "Open one related technology signal and look for the concrete change it introduces.",
    "Use the background knowledge links to fill in concepts that are assumed but not always explained.",
    "Decide whether the signal is worth testing now, tracking, or simply understanding."
  ];
}

export default async function SkillDetailPage({
  params
}: SkillDetailPageProps) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  const technologies = getAllTechnologies();
  const knowledgeItems = getAllKnowledge();
  const tags = getTagsByIds(skill.tags);
  const relatedTechnologies = getRelatedTechnologies(skill, technologies);
  const relatedKnowledge = getRelatedKnowledge(skill, knowledgeItems);

  return (
    <UserPageShell
      title={skill.title}
      description={skill.summary}
      sectionLabel="Understanding Skill"
      showHeader={false}
      className="skill-detail-page"
    >
      <div className="skill-detail-layout">
        <main className="skill-detail-main">
          <section className="skill-detail-hero">
            <p className="skill-detail-kicker">
              {skillTypeLabels[skill.skillType]}
            </p>
            <h1>{skill.title}</h1>
            <p>{skill.summary}</p>
            <div className="skill-detail-hero__meta">
              <span>{heatLabels[skill.heatLevel]}</span>
              <span>{learningCostLabels[skill.learningCost]}</span>
            </div>
            {tags.length > 0 ? <TagList tags={tags} limit={4} /> : null}
          </section>

          {skill.content ? (
            <section className="skill-detail-section skill-detail-section--lead">
              <h2>What this skill helps you do</h2>
              <p>{skill.content}</p>
            </section>
          ) : null}

          <section className="skill-detail-section">
            <h2>Why this skill matters for AI signals</h2>
            <p>{getSkillSignalExplanation(skill)}</p>
          </section>

          {relatedTechnologies.length > 0 ? (
            <section className="skill-detail-section">
              <div className="skill-detail-section__header">
                <div>
                  <p>Practice with published signals</p>
                  <h2>Technology signals this skill helps evaluate</h2>
                </div>
              </div>
              <div className="skill-detail-related-list">
                {relatedTechnologies.map((technology) => {
                  const technologyTags = getTagsByIds(technology.tags);

                  return (
                    <article
                      className="skill-detail-related-card"
                      key={technology.id}
                    >
                      <div>
                        <p className="skill-detail-related-card__meta">
                          {technology.sourceName} · {technology.publishDate}
                        </p>
                        <h3>
                          <Link href={`/technologies/${technology.slug}`}>
                            {getPreferredTechnologyTitle(technology)}
                          </Link>
                        </h3>
                        <p>{getPreferredTechnologySummary(technology)}</p>
                        {technology.whyItMatters ? (
                          <div className="skill-detail-related-card__note">
                            <span>Why this is a useful practice case</span>
                            <p>{technology.whyItMatters}</p>
                          </div>
                        ) : null}
                        {technologyTags.length > 0 ? (
                          <TagList tags={technologyTags} limit={2} />
                        ) : null}
                      </div>
                      <Link
                        className="skill-detail-related-card__link"
                        href={`/technologies/${technology.slug}`}
                      >
                        Open related signal
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {relatedKnowledge.length > 0 ? (
            <section className="skill-detail-section">
              <div className="skill-detail-section__header">
                <div>
                  <p>Background concepts</p>
                  <h2>Knowledge to pair with this skill</h2>
                </div>
              </div>
              <div className="skill-detail-related-list">
                {relatedKnowledge.map((knowledge) => {
                  const knowledgeTags = getTagsByIds(knowledge.tags);

                  return (
                    <article
                      className="skill-detail-related-card skill-detail-related-card--knowledge"
                      key={knowledge.id}
                    >
                      <div>
                        <p className="skill-detail-related-card__meta">
                          {knowledge.category} · {knowledge.difficulty}
                        </p>
                        <h3>
                          <Link href={`/knowledge/${knowledge.slug}`}>
                            {knowledge.title}
                          </Link>
                        </h3>
                        <p>{knowledge.summary}</p>
                        <div className="skill-detail-related-card__note">
                          <span>Why it helps</span>
                          <p>
                            This concept gives the background needed to apply
                            the skill when reading new AI technology signals.
                          </p>
                        </div>
                        {knowledgeTags.length > 0 ? (
                          <TagList tags={knowledgeTags} limit={2} />
                        ) : null}
                      </div>
                      <Link
                        className="skill-detail-related-card__link"
                        href={`/knowledge/${knowledge.slug}`}
                      >
                        View concept
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="skill-detail-section">
            <h2>How to use this skill</h2>
            <ol className="skill-detail-steps">
              {getSkillUseSteps(skill).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </main>

        <aside className="skill-detail-aside" aria-label="Skill summary">
          <section className="skill-detail-aside-card">
            <p className="skill-detail-kicker">Skill profile</p>
            <dl className="skill-detail-profile">
              <div>
                <dt>Category</dt>
                <dd>{skillTypeLabels[skill.skillType]}</dd>
              </div>
              <div>
                <dt>Current heat</dt>
                <dd>{heatLabels[skill.heatLevel]}</dd>
              </div>
              <div>
                <dt>Learning cost</dt>
                <dd>{learningCostLabels[skill.learningCost]}</dd>
              </div>
              <div>
                <dt>Technology signals</dt>
                <dd>{relatedTechnologies.length}</dd>
              </div>
              <div>
                <dt>Background concepts</dt>
                <dd>{relatedKnowledge.length}</dd>
              </div>
            </dl>
          </section>

          {tags.length > 0 ? (
            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">Topics</p>
              <TagList tags={tags} limit={6} />
            </section>
          ) : null}

          <section className="skill-detail-aside-card">
            <p className="skill-detail-kicker">Reading path</p>
            <p>
              Start with the skill explanation, open a related signal, then use
              the linked concepts to fill in the background.
            </p>
          </section>
        </aside>
      </div>
    </UserPageShell>
  );
}
