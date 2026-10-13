import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import {
  LibraryFilter,
  type LibraryFilterSection
} from "@/components/library-filter";
import { RelationDensity } from "@/components/relation-density";
import { TagList } from "@/components/tag-list";
import { UnbreakableTitle } from "@/components/unbreakable-title";
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
  DifficultyLevel,
  KnowledgeItem,
  SkillItem,
  TechnologyItem
} from "@/types/content";
import { buildPageMetadata } from "@/lib/site-metadata";

export function getKnowledgePageMetadata(locale: Locale) {
  const copy = libraryCopy[locale].knowledge;

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/knowledge",
    locale
  });
}

/** The order the levels are listed in; their copy is in libraryCopy. */
const difficultyOrder: DifficultyLevel[] = [
  "foundation",
  "intermediate",
  "advanced"
];

function getRelatedTechnologies(
  item: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedSkillCount(
  item: KnowledgeItem,
  skills: SkillItem[]
): number {
  return skills.filter((skill) => item.relatedSkillIds.includes(skill.id))
    .length;
}

export async function KnowledgePage({
  searchParams,
  locale = "zh"
}: {
  searchParams: Promise<{ q?: string | string[] }>;
  locale?: Locale;
}) {
  const copy = libraryCopy[locale];
  const labels = contentLabelsByLocale[locale];
  // Knowledge entries exist in Chinese only; on the English site they are
  // marked.
  const entryLang = contentLangAttr(locale);
  const { q } = await searchParams;
  const initialQuery = parseLibraryFilterQuery(q);
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
  const groupedKnowledge = difficultyOrder
    .map((id) => ({
      id,
      ...copy.knowledge.sections[id],
      items: knowledgeItems.filter((item) => item.difficulty === id)
    }))
    .filter((section) => section.items.length > 0);

  const filterSections: LibraryFilterSection[] = groupedKnowledge.map(
    (section) => ({
      id: section.id,
      header: (
        <div className="skills-library-section__header">
          <div>
            <p className="eyebrow user-eyebrow">
              {labels.difficulty[section.id]}
            </p>
            <h2>{section.title}</h2>
          </div>
          <p>{section.description}</p>
        </div>
      ),
      items: section.items.map((item) => {
        const relatedTechnologies = getRelatedTechnologies(item, technologies);
        const relatedTechnologyPreview = relatedTechnologies.slice(0, 2);
        const relatedSkillTotal = getRelatedSkillCount(item, skills);
        const tags = localizeTags(getTagsByIds(item.tags), locale);

        return {
          id: item.id,
          // What the reader sees for this concept: its card, including the
          // category stamp.
          text: buildLibraryFilterText([
            item.title,
            item.summary,
            ...tags.map((tag) => tag.name),
            labels.knowledgeCategory[item.category]
          ]),
          card: (
            <DossierCard className="skill-library-card knowledge-library-card">
              <div className="dossier-technology-card__chips">
                <DossierStampTag>
                  {labels.knowledgeCategory[item.category]}
                </DossierStampTag>
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {labels.difficulty[item.difficulty]}
                </DossierStampTag>
              </div>
              <h2 lang={entryLang}>
                <Link href={localePath(locale, `/knowledge/${item.slug}`)}>
                  <UnbreakableTitle text={item.title} />
                </Link>
              </h2>
              <p lang={entryLang}>{item.summary}</p>
              <DossierCatalogNote label={copy.knowledge.outcomeLabel}>
                {copy.knowledge.outcomes[item.category]}
              </DossierCatalogNote>
              <RelationDensity
                label={locale === "zh" ? undefined : copy.relationLabel}
                items={[
                  {
                    n: relatedTechnologies.length,
                    label: copy.knowledge.densityTechnologies
                  },
                  { n: relatedSkillTotal, label: copy.knowledge.densitySkills }
                ]}
              />
              {relatedTechnologyPreview.length > 0 ? (
                <div className="skill-library-card__signals">
                  <span>{copy.knowledge.explainsSignals}</span>
                  <ul>
                    {relatedTechnologyPreview.map((technology) => {
                      const title = getTechnologyTitleForLocale(
                        technology,
                        locale
                      );

                      return (
                        <li key={technology.id}>
                          <Link
                            href={localePath(
                              locale,
                              `/technologies/${technology.slug}`
                            )}
                            lang={contentLangAttr(locale, title.language)}
                          >
                            {title.text}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <TagList tags={tags} limit={3} />
              <Link
                className="skill-library-card__link"
                href={localePath(locale, `/knowledge/${item.slug}`)}
              >
                {copy.knowledge.open}
              </Link>
            </DossierCard>
          )
        };
      })
    })
  );

  return (
    <UserPageShell
      title={copy.knowledge.title}
      description={copy.knowledge.description}
      sectionLabel={copy.knowledge.sectionLabel}
      className="skills-library-page knowledge-library-page dossier"
    >
      {knowledgeItems.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">{copy.knowledge.emptyEyebrow}</p>
          <h2>{copy.knowledge.emptyTitle}</h2>
          <p>{copy.knowledge.emptyBody}</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div>
              <p>{copy.knowledge.intro}</p>
            </div>
            <dl
              className="skills-library-stats"
              aria-label={copy.knowledge.statsLabel}
            >
              <div>
                <dt>{knowledgeItems.length}</dt>
                <dd>{copy.knowledge.statConcepts}</dd>
              </div>
              <div>
                <dt>{foundationCount}</dt>
                <dd>{copy.knowledge.statFoundation}</dd>
              </div>
              <div>
                <dt>{relatedSkillCount}</dt>
                <dd>{copy.knowledge.statSkills}</dd>
              </div>
              <div>
                <dt>{relatedTechnologyCount}</dt>
                <dd>{copy.knowledge.statSignals}</dd>
              </div>
            </dl>
          </section>

          <ChineseOnlyNote locale={locale}>
            {copy.knowledge.chineseOnly}
          </ChineseOnlyNote>

          <LibraryFilter
            kind="knowledge"
            label={copy.knowledge.filterLabel}
            placeholder={copy.knowledge.filterPlaceholder}
            countUnit={copy.knowledge.countUnit}
            noun={copy.knowledge.noun}
            initialQuery={initialQuery}
            sections={filterSections}
          />
        </>
      )}
    </UserPageShell>
  );
}
