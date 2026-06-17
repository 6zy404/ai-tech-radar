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
  HeatLevel,
  KnowledgeItem,
  LearningCost,
  SkillItem,
  SkillType,
  TechnologyItem
} from "@/types/content";

const skillTypeSections: Array<{
  id: SkillType;
  title: string;
  description: string;
  focus: string;
}> = [
  {
    id: "engineering",
    title: "Engineering execution",
    description: "Build, integrate, and operate AI systems in real products.",
    focus: "Use these skills when a signal may change how teams build or ship."
  },
  {
    id: "analysis",
    title: "Evaluation and analysis",
    description: "Judge whether a signal is useful, risky, or ready to test.",
    focus: "Use these skills to separate durable signals from temporary noise."
  },
  {
    id: "product",
    title: "Product judgement",
    description: "Turn technical changes into scoped product decisions.",
    focus: "Use these skills before turning a technology into a roadmap item."
  },
  {
    id: "operations",
    title: "Operations and adoption",
    description: "Keep AI systems observable, reliable, and safe to operate.",
    focus: "Use these skills when a signal affects rollout, reliability, or support."
  },
  {
    id: "communication",
    title: "Team communication",
    description: "Explain tradeoffs and coordinate adoption across teams.",
    focus: "Use these skills to help non-specialists understand technical change."
  }
];

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

function getSkillOutcome(skill: SkillItem): string {
  switch (skill.skillType) {
    case "engineering":
      return "Helps you decide whether a new AI capability is practical to build, integrate, and maintain.";
    case "analysis":
      return "Helps you evaluate evidence, failure modes, and whether the signal is ready to test.";
    case "product":
      return "Helps you translate technical change into a product decision with a clear scope.";
    case "operations":
      return "Helps you judge rollout, monitoring, reliability, and operational risk.";
    case "communication":
      return "Helps you explain the change and coordinate adoption across teams.";
    default:
      return "Helps you read technology signals with more context and less guesswork.";
  }
}

export default function SkillsPage() {
  const skills = getAllSkills();
  const technologies = getAllTechnologies();
  const knowledgeItems = getAllKnowledge();

  const hotSkills = skills.filter((skill) => skill.heatLevel === "hot").length;
  const relatedTechnologyCount = new Set(
    skills.flatMap((skill) => skill.relatedTechnologyIds)
  ).size;
  const relatedKnowledgeCount = new Set(
    skills.flatMap((skill) => skill.relatedKnowledgeIds)
  ).size;

  const groupedSkills = skillTypeSections
    .map((section) => ({
      ...section,
      items: skills.filter((skill) => skill.skillType === section.id)
    }))
    .filter((section) => section.items.length > 0);

  return (
    <UserPageShell
      title="Skills for Understanding AI Signals"
      description="Use these practical skills to decide whether a new AI technology signal is worth testing, monitoring, or explaining to your team."
      sectionLabel="Understanding Skills"
      className="skills-library-page"
    >
      {skills.length === 0 ? (
        <section className="skills-library-empty">
          <p className="skills-library-empty__eyebrow">Skills library</p>
          <h2>No skills yet.</h2>
          <p>
            Published skills will appear here when they are connected to
            user-facing technology signals.
          </p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              <p className="skills-library-kicker">How to use this library</p>
              <h2>
                Skills connect fast-moving technology signals to practical
                evaluation.
              </h2>
              <p>
                Start with the skill that matches your role, then open the
                linked technology signals and background concepts to understand
                where the change matters.
              </p>
            </div>
            <dl className="skills-library-stats" aria-label="Skills summary">
              <div>
                <dt>{skills.length}</dt>
                <dd>skills tracked</dd>
              </div>
              <div>
                <dt>{hotSkills}</dt>
                <dd>hot now</dd>
              </div>
              <div>
                <dt>{relatedTechnologyCount}</dt>
                <dd>published signals connected</dd>
              </div>
              <div>
                <dt>{relatedKnowledgeCount}</dt>
                <dd>background concepts linked</dd>
              </div>
            </dl>
          </section>

          <section className="skills-library-guide" aria-label="Reading path">
            <article>
              <span>01</span>
              <h3>Pick a skill</h3>
              <p>Choose the ability you need for judging a technology signal.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Open a signal</h3>
              <p>Use related published signals as concrete examples.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Fill the background</h3>
              <p>Use knowledge links when the signal depends on older ideas.</p>
            </article>
          </section>

          <div className="skills-library-groups">
            {groupedSkills.map((section) => (
              <section className="skills-library-section" key={section.id}>
                <div className="skills-library-section__header">
                  <div>
                    <p>{section.id}</p>
                    <h2>{section.title}</h2>
                  </div>
                  <span>{section.focus}</span>
                </div>

                <div className="skills-library-card-grid">
                  {section.items.map((skill) => {
                    const relatedTechnologies = getRelatedTechnologies(
                      skill,
                      technologies
                    );
                    const relatedKnowledge = getRelatedKnowledge(
                      skill,
                      knowledgeItems
                    );
                    const tags = getTagsByIds(skill.tags);

                    return (
                      <article className="skill-library-card" key={skill.id}>
                        <div className="skill-library-card__meta">
                          <span>{heatLabels[skill.heatLevel]}</span>
                          <span>{learningCostLabels[skill.learningCost]}</span>
                        </div>
                        <h3>
                          <Link href={`/skills/${skill.slug}`}>
                            {skill.title}
                          </Link>
                        </h3>
                        <p className="skill-library-card__summary">
                          {skill.summary}
                        </p>
                        <div className="skill-library-card__outcome">
                          <span>Helps you decide</span>
                          <p>{getSkillOutcome(skill)}</p>
                        </div>
                        <div className="skill-library-card__counts">
                          <span>
                            {relatedTechnologies.length} technology signals
                          </span>
                          <span>
                            {relatedKnowledge.length} background concepts
                          </span>
                        </div>
                        {relatedTechnologies.length > 0 ? (
                          <div className="skill-library-card__signals">
                            <span>Practice with</span>
                            {relatedTechnologies.slice(0, 2).map((technology) => (
                              <Link
                                href={`/technologies/${technology.slug}`}
                                key={technology.id}
                              >
                                {getPreferredTechnologyTitle(technology)}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                        {tags.length > 0 ? (
                          <TagList tags={tags} limit={3} />
                        ) : null}
                        <Link
                          className="skill-library-card__link"
                          href={`/skills/${skill.slug}`}
                        >
                          View skill
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
