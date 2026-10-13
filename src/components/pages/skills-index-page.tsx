import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import {
  LibraryFilter,
  type LibraryFilterSection
} from "@/components/library-filter";
import { RelationDensity } from "@/components/relation-density";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import { contentLabelsByLocale } from "@/lib/content-labels";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import { libraryCopy } from "@/lib/i18n/copy/library";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr } from "@/lib/i18n/text-lang";
import { localizeTags } from "@/lib/i18n/topic-names";
import {
  buildLibraryFilterText,
  parseLibraryFilterQuery
} from "@/lib/library-filter";
import { getTechnologyTitleForLocale } from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  SkillItem,
  SkillType,
  TechnologyItem
} from "@/types/content";
import { buildPageMetadata } from "@/lib/site-metadata";

export function getSkillsPageMetadata(locale: Locale) {
  const copy = libraryCopy[locale].skills;

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/skills",
    locale
  });
}

/** The order the skill areas are listed in; their copy is in libraryCopy. */
const skillTypeOrder: SkillType[] = [
  "engineering",
  "analysis",
  "product",
  "operations",
  "communication"
];

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

export async function SkillsPage({
  searchParams,
  locale = "zh"
}: {
  searchParams: Promise<{ q?: string | string[] }>;
  locale?: Locale;
}) {
  const copy = libraryCopy[locale];
  const labels = contentLabelsByLocale[locale];
  // Skill entries exist in Chinese only; on the English site they are marked.
  const entryLang = contentLangAttr(locale);
  const { q } = await searchParams;
  const initialQuery = parseLibraryFilterQuery(q);
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

  const groupedSkills = skillTypeOrder
    .map((id) => ({
      id,
      ...copy.skills.sections[id],
      items: skills.filter((skill) => skill.skillType === id)
    }))
    .filter((section) => section.items.length > 0);

  const filterSections: LibraryFilterSection[] = groupedSkills.map(
    (section) => ({
      id: section.id,
      header: (
        <div className="skills-library-section__header">
          <div>
            <p className="eyebrow user-eyebrow">{copy.skills.sectionEyebrow}</p>
            <h2>{section.title}</h2>
          </div>
          <p>{section.focus}</p>
        </div>
      ),
      items: section.items.map((skill) => {
        const relatedTechnologies = getRelatedTechnologies(skill, technologies);
        const relatedKnowledge = getRelatedKnowledge(skill, knowledgeItems);
        const tags = localizeTags(getTagsByIds(skill.tags), locale);

        return {
          id: skill.id,
          // What the reader sees for this skill: its card, and the 技能方向
          // heading it is filed under.
          text: buildLibraryFilterText([
            skill.title,
            skill.summary,
            ...tags.map((tag) => tag.name),
            section.title
          ]),
          card: (
            <DossierCard className="skill-library-card">
              <div className="dossier-technology-card__chips">
                <DossierStampTag>
                  {labels.heat[skill.heatLevel]}
                </DossierStampTag>
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {labels.learningCost[skill.learningCost]}
                </DossierStampTag>
              </div>
              <h3 lang={entryLang}>
                <Link href={localePath(locale, `/skills/${skill.slug}`)}>
                  {skill.title}
                </Link>
              </h3>
              <p className="skill-library-card__summary" lang={entryLang}>
                {skill.summary}
              </p>
              <RelationDensity
                label={locale === "zh" ? undefined : copy.relationLabel}
                items={[
                  {
                    n: relatedTechnologies.length,
                    label: copy.skills.densityTechnologies
                  },
                  {
                    n: relatedKnowledge.length,
                    label: copy.skills.densityKnowledge
                  }
                ]}
              />
              {relatedTechnologies.length > 0 ? (
                <div className="skill-library-card__signals">
                  <span>{copy.skills.practiceWith}</span>
                  {relatedTechnologies.slice(0, 2).map((technology) => {
                    const title = getTechnologyTitleForLocale(
                      technology,
                      locale
                    );

                    return (
                      <Link
                        href={localePath(
                          locale,
                          `/technologies/${technology.slug}`
                        )}
                        key={technology.id}
                        lang={contentLangAttr(locale, title.language)}
                      >
                        {title.text}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              {tags.length > 0 ? <TagList tags={tags} limit={3} /> : null}
              <Link
                className="skill-library-card__link"
                href={localePath(locale, `/skills/${skill.slug}`)}
              >
                {copy.skills.open}
              </Link>
            </DossierCard>
          )
        };
      })
    })
  );

  return (
    <UserPageShell
      title={copy.skills.title}
      description={copy.skills.description}
      sectionLabel={copy.skills.sectionLabel}
      className="skills-library-page dossier"
    >
      {skills.length === 0 ? (
        <section className="skills-library-empty">
          <p className="skills-library-empty__eyebrow">
            {copy.skills.emptyEyebrow}
          </p>
          <h2>{copy.skills.emptyTitle}</h2>
          <p>{copy.skills.emptyBody}</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              <p>{copy.skills.intro}</p>
            </div>
            <dl
              className="skills-library-stats"
              aria-label={copy.skills.statsLabel}
            >
              <div>
                <dt>{skills.length}</dt>
                <dd>{copy.skills.statSkills}</dd>
              </div>
              <div>
                <dt>{hotSkills}</dt>
                <dd>{copy.skills.statHot}</dd>
              </div>
              <div>
                <dt>{relatedTechnologyCount}</dt>
                <dd>{copy.skills.statSignals}</dd>
              </div>
              <div>
                <dt>{relatedKnowledgeCount}</dt>
                <dd>{copy.skills.statKnowledge}</dd>
              </div>
            </dl>
          </section>

          <ChineseOnlyNote locale={locale}>
            {copy.skills.chineseOnly}
          </ChineseOnlyNote>

          <LibraryFilter
            kind="skills"
            label={copy.skills.filterLabel}
            placeholder={copy.skills.filterPlaceholder}
            countUnit={copy.skills.countUnit}
            noun={copy.skills.noun}
            initialQuery={initialQuery}
            sections={filterSections}
          />
        </>
      )}
    </UserPageShell>
  );
}
