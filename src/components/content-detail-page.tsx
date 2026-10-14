import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { ContentBody } from "@/components/content-body";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierRegisterRow } from "@/components/dossier-register-row";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { FollowableTagList } from "@/components/followable-tag-list";
import { LangScope, LangSpan } from "@/components/lang-scope";
import { PageToc } from "@/components/page-toc";
import { ReadingProgress } from "@/components/reading-progress";
import {
  RelationshipGraph,
  type RelationshipGraphNode
} from "@/components/relationship-graph";
import { SectionHeading } from "@/components/section-link";
import { TagList } from "@/components/tag-list";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import {
  contentLabelsByLocale,
  type ContentLabelSet
} from "@/lib/content-labels";
import { commonCopy } from "@/lib/i18n/copy/common";
import { contentDetailCopy } from "@/lib/i18n/copy/content-detail";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { localizeTags } from "@/lib/i18n/topic-names";
import { buildKnowledgeLinkTargets } from "@/lib/knowledge-autolink";
import {
  findRelationIn,
  getAllLinkRelations
} from "@/lib/link-relation-workflow";
import {
  getKnowledgeMentions,
  type KnowledgeMentionRow
} from "@/lib/knowledge-mentions";
import {
  contentDetailTocIds as tocIds,
  getContentDetailTocCandidates,
  selectPageTocEntries
} from "@/lib/page-toc";
import { getPrerequisiteChain } from "@/lib/prerequisite-chain";
import { estimateContentDetailReadingMinutes } from "@/lib/reading-time";
import { buildPageMetadata } from "@/lib/site-metadata";
import {
  getRelationTypeLabel,
  getTechnologySummaryForLocale,
  getTechnologyTitleForLocale
} from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  RelationType,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

// The public skill and knowledge detail pages: one skeleton — read-first
// chain, hero, body, relationship graph, related signals, the other kind's
// related entries, profile aside — and one descriptor per kind for what
// differs. The words are in `contentDetailCopy`, per interface language;
// skill and knowledge entries themselves exist in Chinese only, so on the
// English site they carry `lang="zh-CN"`.

type DetailItem = SkillItem | KnowledgeItem;

interface RelatedEntry {
  id: string;
  kind: "skill" | "knowledge";
  title: string;
  href: string;
  summary: string;
  /** The card's meta line, e.g. 「机器学习 · 基础」. */
  meta: string;
  tags: string[];
}

function toKnowledgeEntry(
  knowledge: KnowledgeItem,
  locale: Locale
): RelatedEntry {
  const labels = contentLabelsByLocale[locale];

  return {
    id: knowledge.id,
    kind: "knowledge",
    title: knowledge.title,
    href: localePath(locale, `/knowledge/${knowledge.slug}`),
    summary: knowledge.summary,
    meta: `${labels.knowledgeCategory[knowledge.category]} · ${labels.difficulty[knowledge.difficulty]}`,
    tags: knowledge.tags
  };
}

function toSkillEntry(skill: SkillItem, locale: Locale): RelatedEntry {
  const labels = contentLabelsByLocale[locale];

  return {
    id: skill.id,
    kind: "skill",
    title: skill.title,
    href: localePath(locale, `/skills/${skill.slug}`),
    summary: skill.summary,
    meta: `${labels.skillType[skill.skillType]} · ${labels.heat[skill.heatLevel]}`,
    tags: skill.tags
  };
}

export interface ContentDetailKind<TItem extends DetailItem> {
  kind: "skill" | "knowledge";
  publicPath: string;
  className: string;
  kicker: (item: TItem, labels: ContentLabelSet) => string;
  stamps: (
    item: TItem,
    labels: ContentLabelSet
  ) => { label: string; muted?: boolean }[];
  /** Values of the profile rows, in the order of the copy's profileLabels. */
  profileValues: (item: TItem, labels: ContentLabelSet) => string[];
  /**
   * Knowledge only: the signals whose body links this page, minus the ones
   * the related-signals section already lists. Skills have no body links.
   */
  getBodyMentionRows?: (item: TItem) => KnowledgeMentionRow[];
  getRelatedEntries: (item: TItem, locale: Locale) => RelatedEntry[];
}

export const skillDetailKind: ContentDetailKind<SkillItem> = {
  kind: "skill",
  publicPath: "/skills",
  className: "skill-detail-page dossier",
  kicker: (skill, labels) => labels.skillType[skill.skillType],
  stamps: (skill, labels) => [
    { label: labels.heat[skill.heatLevel] },
    { label: labels.learningCost[skill.learningCost], muted: true }
  ],
  profileValues: (skill, labels) => [
    labels.skillType[skill.skillType],
    labels.heat[skill.heatLevel],
    labels.learningCostValue[skill.learningCost]
  ],
  getRelatedEntries: (skill, locale) =>
    getAllKnowledge()
      .filter((knowledge) => skill.relatedKnowledgeIds.includes(knowledge.id))
      .map((knowledge) => toKnowledgeEntry(knowledge, locale))
};

export const knowledgeDetailKind: ContentDetailKind<KnowledgeItem> = {
  kind: "knowledge",
  publicPath: "/knowledge",
  className: "skill-detail-page knowledge-detail-page dossier",
  kicker: (knowledge, labels) => labels.knowledgeCategory[knowledge.category],
  // The category is already the kicker; repeating it as the first chip
  // said the same thing twice, so the knowledge hero carries difficulty
  // only — as the skill hero carries type in the kicker and heat/cost in
  // the chips.
  stamps: (knowledge, labels) => [
    { label: labels.difficulty[knowledge.difficulty], muted: true }
  ],
  profileValues: (knowledge, labels) => [
    labels.knowledgeCategory[knowledge.category],
    labels.difficulty[knowledge.difficulty]
  ],
  getBodyMentionRows: (knowledge) =>
    getKnowledgeMentions(
      knowledge.id,
      getAllTechnologies(),
      buildKnowledgeLinkTargets(getAllKnowledge()),
      knowledge.relatedTechnologyIds
    ),
  getRelatedEntries: (knowledge, locale) =>
    getAllSkills()
      .filter((skill) => knowledge.relatedSkillIds.includes(skill.id))
      .map((skill) => toSkillEntry(skill, locale))
};

export function buildContentDetailMetadata<TItem extends DetailItem>(
  kind: ContentDetailKind<TItem>,
  slug: string,
  item: TItem | undefined,
  locale: Locale = "zh"
): Metadata {
  const copy = contentDetailCopy[locale];

  if (!item) {
    return buildPageMetadata({
      title: copy.shared.notFoundTitle,
      path: `${kind.publicPath}/${slug}`,
      noIndex: true,
      locale
    });
  }

  return buildPageMetadata({
    title: `${item.title} · ${copy[kind.kind].noun}`,
    description: item.summary,
    path: `${kind.publicPath}/${item.slug}`,
    type: "article",
    largeImage: true,
    locale
  });
}

function RelatedCard({
  className,
  meta,
  relationLabel,
  title,
  href,
  summary,
  note,
  tags,
  linkText,
  titleLang,
  summaryLang,
  locale
}: {
  className: string;
  meta: ReactNode;
  relationLabel: string;
  title: string;
  href: string;
  summary: string;
  note?: { label?: string; text: string; lang?: string };
  tags: TopicTag[];
  linkText: string;
  titleLang?: string;
  summaryLang?: string;
  locale: Locale;
}) {
  return (
    <DossierCard className={className}>
      <div>
        <div className="skill-detail-related-card__toprow">
          <p className="skill-detail-related-card__meta">{meta}</p>
          <DossierStampTag>{relationLabel}</DossierStampTag>
        </div>
        <h3 lang={titleLang}>
          <Link href={href}>{title}</Link>
        </h3>
        <p lang={summaryLang}>{summary}</p>
        {note ? (
          <DossierCatalogNote label={note.label} locale={locale}>
            <LangSpan lang={note.lang}>{note.text}</LangSpan>
          </DossierCatalogNote>
        ) : null}
        {tags.length > 0 ? <TagList tags={tags} limit={2} /> : null}
      </div>
      <Link className="skill-detail-related-card__link" href={href}>
        {linkText}
      </Link>
    </DossierCard>
  );
}

function RelatedSection({
  id,
  sharePath,
  eyebrow,
  heading,
  children
}: {
  id: string;
  sharePath: string;
  eyebrow: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="skill-detail-section">
      <div className="skill-detail-section__header">
        <div>
          <p>{eyebrow}</p>
          <SectionHeading sectionId={id} sharePath={sharePath}>
            {heading}
          </SectionHeading>
        </div>
      </div>
      <div className="skill-detail-related-list">{children}</div>
    </section>
  );
}

// Six rows open, the rest behind 再看 N 条; on 2026-10-12 three pages fold
// (14, 9 and 8 rows).
const bodyMentionsShown = 6;

function BodyMentionRow({
  row,
  locale
}: {
  row: KnowledgeMentionRow;
  locale: Locale;
}) {
  // The excerpt is always from the Chinese body; the title follows the
  // interface language like every other signal title.
  const technology =
    locale === "zh"
      ? undefined
      : getAllTechnologies().find((item) => item.id === row.id);
  const title = technology
    ? getTechnologyTitleForLocale(technology, locale)
    : { text: row.title, language: "zh" as const };

  return (
    <li>
      <DossierRegisterRow
        title={title.text}
        date={row.publishDate}
        href={localePath(locale, `/technologies/${row.slug}`)}
        headingLevel={3}
        titleLang={contentLangAttr(locale, title.language)}
        detailLang={contentLangAttr(locale)}
      >
        {row.excerpt.before}
        <strong>{row.excerpt.match}</strong>
        {row.excerpt.after}
      </DossierRegisterRow>
    </li>
  );
}

function BodyMentionsSection({
  id,
  sharePath,
  eyebrow,
  heading,
  note,
  rows,
  moreLabel,
  locale
}: {
  id: string;
  sharePath: string;
  eyebrow: string;
  heading: string;
  note: string;
  rows: KnowledgeMentionRow[];
  moreLabel: (n: number) => string;
  locale: Locale;
}) {
  const shown = rows.slice(0, bodyMentionsShown);
  const rest = rows.slice(bodyMentionsShown);

  return (
    <section id={id} className="skill-detail-section knowledge-mentions">
      <div className="skill-detail-section__header">
        <div>
          <p>{eyebrow}</p>
          <SectionHeading sectionId={id} sharePath={sharePath}>
            {heading}
          </SectionHeading>
        </div>
      </div>
      <p className="knowledge-mentions__note">{note}</p>
      <ul className="knowledge-mentions__list">
        {shown.map((row) => (
          <BodyMentionRow key={row.id} row={row} locale={locale} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="knowledge-mentions__more" data-print="hide">
          <summary>{moreLabel(rest.length)}</summary>
          <ul className="knowledge-mentions__list">
            {rest.map((row) => (
              <BodyMentionRow key={row.id} row={row} locale={locale} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function ContentDetailPage<TItem extends DetailItem>({
  kind,
  item,
  locale = "zh"
}: {
  kind: ContentDetailKind<TItem>;
  item: TItem;
  locale?: Locale;
}) {
  const copy = contentDetailCopy[locale];
  const kindCopy = copy[kind.kind];
  const labels = contentLabelsByLocale[locale];
  // The entry itself — title, summary, body, notes — is Chinese only.
  const entryLang = contentLangAttr(locale);
  const tags = localizeTags(getTagsByIds(item.tags), locale);
  const sharePath = localePath(locale, `${kind.publicPath}/${item.slug}`);
  const relatedTechnologies: TechnologyItem[] = getAllTechnologies().filter(
    (technology) => item.relatedTechnologyIds.includes(technology.id)
  );
  const allRelatedEntries = kind.getRelatedEntries(item, locale);
  // `requires` 必备 prerequisites, deepest first. A direct prerequisite is
  // always one of the related entries (skills and knowledge only link across
  // kinds), so it moves up into 先读这些 rather than appearing twice with the
  // same note; the graph and the aside counts still include it.
  const prerequisites = getPrerequisiteChain(item.id).map((step) => ({
    step,
    entry:
      step.kind === "skill"
        ? toSkillEntry(step.item, locale)
        : toKnowledgeEntry(step.item, locale)
  }));
  const prerequisiteIds = new Set(prerequisites.map(({ step }) => step.id));
  // One read of the merged relations for every lookup below; reading it per
  // related item cost about 3ms each, 126ms on a skill with 44 relations.
  const relations = getAllLinkRelations();
  const technologyRelations = relatedTechnologies.map((technology) =>
    findRelationIn(relations, item.id, kind.kind, technology.id, "technology")
  );
  const allEntryRelations = allRelatedEntries.map((entry) =>
    findRelationIn(relations, item.id, kind.kind, entry.id, entry.kind)
  );
  const relatedEntries = allRelatedEntries.filter(
    (entry) => !prerequisiteIds.has(entry.id)
  );
  const entryRelations = allEntryRelations.filter(
    (_, index) => !prerequisiteIds.has(allRelatedEntries[index].id)
  );
  const relationLabel = (relationType: RelationType) =>
    getRelationTypeLabel(relationType, "zh", locale);
  const technologyTitles = relatedTechnologies.map((technology) =>
    getTechnologyTitleForLocale(technology, locale)
  );
  const graphNodes: RelationshipGraphNode[] = [
    ...relatedTechnologies.map((technology, index) => ({
      title: technologyTitles[index].text,
      href: localePath(locale, `/technologies/${technology.slug}`),
      kind: "technology" as const,
      relationLabel: relationLabel(technologyRelations[index].relationType),
      note: technologyRelations[index].note,
      lang: contentLangAttr(locale, technologyTitles[index].language)
    })),
    ...allRelatedEntries.map((entry, index) => ({
      title: entry.title,
      href: entry.href,
      kind: entry.kind,
      relationLabel: relationLabel(allEntryRelations[index].relationType),
      note: allEntryRelations[index].note,
      lang: entryLang
    }))
  ];
  const bodyMentionRows = kind.getBodyMentionRows?.(item) ?? [];
  // Same conditions the sections below render on, so the table lists exactly
  // what is on the page.
  const tocEntries = selectPageTocEntries(
    getContentDetailTocCandidates({
      locale,
      kind: kind.kind,
      prerequisiteCount: prerequisites.length,
      hasBody: Boolean(item.content),
      graphNodeCount: graphNodes.length,
      relatedTechnologyCount: relatedTechnologies.length,
      bodyMentionCount: bodyMentionRows.length,
      relatedEntryCount: relatedEntries.length,
      headings: {
        body: kindCopy.leadHeading,
        relatedTechnologies: kindCopy.technologySection.heading,
        bodyMentions: kindCopy.bodyMentions?.heading,
        relatedEntries: kindCopy.related.heading
      }
    })
  );
  const profileValues = kind.profileValues(item, labels);

  return (
    <UserPageShell
      title={item.title}
      description={item.summary}
      sectionLabel={kindCopy.sectionLabel}
      showHeader={false}
      className={kind.className}
    >
      <div className="skill-detail-layout">
        <section className="skill-detail-hero">
          <p className="skill-detail-kicker">{kind.kicker(item, labels)}</p>
          <h1 lang={entryLang}>
            <UnbreakableTitle text={item.title} />
          </h1>
          <p lang={entryLang}>{item.summary}</p>
          <ChineseOnlyNote locale={locale}>
            {kindCopy.chineseOnly}
          </ChineseOnlyNote>
          <div className="skill-detail-hero__meta">
            <span>
              {commonCopy[locale].readingTime(
                estimateContentDetailReadingMinutes(item)
              )}
            </span>
            {kind.stamps(item, labels).map((stamp) => (
              <DossierStampTag
                key={stamp.label}
                className={stamp.muted ? "dossier-stamp-tag--muted" : undefined}
              >
                {stamp.label}
              </DossierStampTag>
            ))}
            <CopyLinkButton sharePath={sharePath} />
          </div>
          {tags.length > 0 ? <TagList tags={tags} limit={4} /> : null}
        </section>

        <div className="skill-detail-layout__body">
          <main className="skill-detail-main">
            <PageToc entries={tocEntries} variant="disclosure" />

            {prerequisites.length > 0 ? (
              <RelatedSection
                id={tocIds.prerequisites}
                sharePath={sharePath}
                eyebrow={copy.shared.prerequisitesEyebrow}
                heading={copy.shared.prerequisitesHeading}
              >
                {prerequisites.map(({ step, entry }) => (
                  <RelatedCard
                    key={entry.id}
                    className="skill-detail-related-card skill-detail-related-card--knowledge"
                    meta={`${copy.shared.entryKinds[entry.kind].label} · ${entry.meta}`}
                    relationLabel={relationLabel("requires")}
                    title={entry.title}
                    href={entry.href}
                    summary={entry.summary}
                    note={
                      step.note
                        ? {
                            label:
                              step.depth === 1
                                ? copy.shared.whyFirst
                                : copy.shared.readBefore(step.requiredByTitle),
                            text: step.note,
                            lang: entryLang
                          }
                        : undefined
                    }
                    tags={localizeTags(getTagsByIds(entry.tags), locale)}
                    linkText={copy.shared.entryKinds[entry.kind].linkText}
                    titleLang={entryLang}
                    summaryLang={entryLang}
                    locale={locale}
                  />
                ))}
              </RelatedSection>
            ) : null}

            {item.content ? (
              <section
                id={tocIds.body}
                className="skill-detail-section skill-detail-section--lead"
              >
                <SectionHeading sectionId={tocIds.body} sharePath={sharePath}>
                  {kindCopy.leadHeading}
                </SectionHeading>
                <LangScope lang={entryLang}>
                  <ContentBody body={item.content} />
                </LangScope>
              </section>
            ) : null}

            <RelationshipGraph
              centerTitle={item.title}
              centerId={item.id}
              centerLang={entryLang}
              nodes={graphNodes}
              sectionClassName="skill-detail-section"
              id={tocIds.graph}
              sharePath={sharePath}
              hint={kindCopy.graphHint}
              locale={locale}
            />

            {relatedTechnologies.length > 0 ? (
              <RelatedSection
                id={tocIds.relatedTechnologies}
                sharePath={sharePath}
                eyebrow={kindCopy.technologySection.eyebrow}
                heading={kindCopy.technologySection.heading}
              >
                {relatedTechnologies.map((technology, index) => {
                  const summary = getTechnologySummaryForLocale(
                    technology,
                    locale
                  );

                  return (
                    <RelatedCard
                      key={technology.id}
                      className="skill-detail-related-card"
                      meta={
                        <>
                          <LangSpan
                            lang={nameLangAttr(locale, technology.sourceName)}
                          >
                            {technology.sourceName}
                          </LangSpan>
                          {" · "}
                          {/* A date must not split at its hyphens (2026- / 07-15) on a narrow card. */}
                          <span className="nowrap-run">
                            {technology.publishDate}
                          </span>
                        </>
                      }
                      relationLabel={relationLabel(
                        technologyRelations[index].relationType
                      )}
                      title={technologyTitles[index].text}
                      href={localePath(
                        locale,
                        `/technologies/${technology.slug}`
                      )}
                      summary={summary.text}
                      note={
                        technology.whyItMatters
                          ? {
                              label: kindCopy.technologySection.noteLabel,
                              text: technology.whyItMatters,
                              lang: entryLang
                            }
                          : undefined
                      }
                      tags={localizeTags(getTagsByIds(technology.tags), locale)}
                      linkText={copy.shared.viewSignal}
                      titleLang={contentLangAttr(
                        locale,
                        technologyTitles[index].language
                      )}
                      summaryLang={contentLangAttr(locale, summary.language)}
                      locale={locale}
                    />
                  );
                })}
              </RelatedSection>
            ) : null}

            {kindCopy.bodyMentions && bodyMentionRows.length > 0 ? (
              <BodyMentionsSection
                id={tocIds.bodyMentions}
                sharePath={sharePath}
                eyebrow={kindCopy.bodyMentions.eyebrow}
                heading={kindCopy.bodyMentions.heading}
                note={copy.shared.mentionsNote(
                  kindCopy.bodyMentions.note,
                  relatedTechnologies.length > 0
                    ? kindCopy.bodyMentions.excludedNote
                    : undefined
                )}
                rows={bodyMentionRows}
                moreLabel={copy.shared.moreRows}
                locale={locale}
              />
            ) : null}

            {relatedEntries.length > 0 ? (
              <RelatedSection
                id={tocIds.relatedEntries[kind.kind]}
                sharePath={sharePath}
                eyebrow={kindCopy.related.eyebrow}
                heading={kindCopy.related.heading}
              >
                {relatedEntries.map((entry, index) => (
                  <RelatedCard
                    key={entry.id}
                    className="skill-detail-related-card skill-detail-related-card--knowledge"
                    meta={entry.meta}
                    relationLabel={relationLabel(
                      entryRelations[index].relationType
                    )}
                    title={entry.title}
                    href={entry.href}
                    summary={entry.summary}
                    note={
                      entryRelations[index].note
                        ? { text: entryRelations[index].note, lang: entryLang }
                        : { text: kindCopy.related.fallbackNote }
                    }
                    tags={localizeTags(getTagsByIds(entry.tags), locale)}
                    linkText={kindCopy.related.linkText}
                    titleLang={entryLang}
                    summaryLang={entryLang}
                    locale={locale}
                  />
                ))}
              </RelatedSection>
            ) : null}
          </main>

          <aside
            className="skill-detail-aside"
            aria-label={kindCopy.asideLabel}
          >
            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">{kindCopy.profileKicker}</p>
              <dl className="skill-detail-profile">
                {[
                  ...profileValues.map((value, index) => ({
                    label: kindCopy.profileLabels[index],
                    value
                  })),
                  {
                    label: copy.shared.profileSignals,
                    value: relatedTechnologies.length
                  },
                  {
                    label: kindCopy.related.countLabel,
                    value: allRelatedEntries.length
                  }
                ].map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {tags.length > 0 ? (
              <section className="skill-detail-aside-card">
                <p className="skill-detail-kicker">{copy.shared.topics}</p>
                <FollowableTagList tags={tags} />
              </section>
            ) : null}

            {/* How to move around the site: nothing to act on in print. */}
            <section className="skill-detail-aside-card" data-print="hide">
              <p className="skill-detail-kicker">
                {copy.shared.readingPathKicker}
              </p>
              <p>{kindCopy.readingPath}</p>
            </section>

            <PageToc
              entries={tocEntries}
              className="skill-detail-aside-card"
              labelClassName="skill-detail-kicker"
            />
          </aside>
        </div>
        <ReadingProgress regionSelector=".skill-detail-main" />
      </div>
    </UserPageShell>
  );
}
