import Link from "next/link";

import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getAllSkills,
  getAllTags,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type { SkillItem, TechnologyItem } from "@/types/content";

const skillTypeSections = [
  {
    id: "engineering",
    title: "Engineering execution",
    description: "Build, integrate, and operate AI systems in real products."
  },
  {
    id: "analysis",
    title: "Evaluation and analysis",
    description: "Judge whether a signal is useful, risky, or ready to test."
  },
  {
    id: "product",
    title: "Product judgement",
    description: "Turn technical changes into scoped product decisions."
  },
  {
    id: "communication",
    title: "Team communication",
    description: "Explain tradeoffs and coordinate adoption across teams."
  }
];

function getRelatedTechnologies(
  skill: SkillItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    skill.relatedTechnologyIds.includes(technology.id)
  );
}

export default function SkillsPage() {
  const skills = getAllSkills();
  const technologies = getAllTechnologies();
  const tags = getAllTags();
  const hotSkills = skills.filter((skill) => skill.heatLevel === "hot").length;
  const groupedSkills = skillTypeSections
    .map((section) => ({
      ...section,
      items: skills.filter((skill) => skill.skillType === section.id)
    }))
    .filter((section) => section.items.length > 0);

  return (
    <UserPageShell
      title="Skills for Understanding AI Technology"
      description="Practice areas that help readers judge whether a new AI signal is usable, risky, or worth deeper evaluation."
      sectionLabel="Understanding Skills"
    >
      <section className="foundation-intro-panel">
        <div>
          <p className="eyebrow user-eyebrow">How to use this library</p>
          <h2>Skills connect technology signals to practical evaluation.</h2>
          <p>
            Use this page when a technology sounds important but the next step is
            unclear. Each skill links back to published technology signals and to
            background knowledge that makes the skill easier to build.
          </p>
        </div>
        <div className="foundation-intro-panel__stats">
          <strong>{skills.length}</strong>
          <span>skills tracked</span>
          <strong>{hotSkills}</strong>
          <span>currently hot</span>
          <strong>{technologies.length}</strong>
          <span>published signals connected</span>
        </div>
      </section>

      <div className="foundation-group-stack">
        {groupedSkills.map((section) => (
          <section key={section.id} className="foundation-group">
            <div className="foundation-group__header">
              <div>
                <p className="eyebrow user-eyebrow">{section.id}</p>
                <h2>{section.title}</h2>
              </div>
              <p>{section.description}</p>
            </div>
            <div className="foundation-index-grid">
              {section.items.map((skill) => {
                const relatedTechnologies = getRelatedTechnologies(
                  skill,
                  technologies
                );
                const relatedTechnologyPreview = relatedTechnologies.slice(0, 2);

                return (
                  <article key={skill.id} className="foundation-index-card">
                    <div className="foundation-index-card__meta">
                      <span>{skill.heatLevel}</span>
                      <span>{skill.learningCost} learning cost</span>
                    </div>
                    <h2>
                      <Link href={`/skills/${skill.slug}`}>{skill.title}</Link>
                    </h2>
                    <p>{skill.summary}</p>
                    <div className="foundation-index-card__section">
                      <span>Helps you evaluate</span>
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
                    <TagList
                      tags={getTagsByIds(skill.tags).filter((tag) =>
                        tags.some((knownTag) => knownTag.id === tag.id)
                      )}
                      limit={3}
                    />
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
