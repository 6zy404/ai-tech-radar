import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ContentBody } from "@/components/content-body";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierRegisterRow } from "@/components/dossier-register-row";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { FollowableTagList } from "@/components/followable-tag-list";
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
  findRelationBetween,
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import {
  difficultyLabels,
  heatLabels,
  knowledgeCategoryLabels,
  learningCostLabels,
  learningCostValues,
  skillTypeLabels
} from "@/lib/content-labels";
import { buildKnowledgeLinkTargets } from "@/lib/knowledge-autolink";
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
import {
  estimateContentDetailReadingMinutes,
  formatReadingTime
} from "@/lib/reading-time";
import { buildPageMetadata } from "@/lib/site-metadata";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle,
  getRelationTypeLabel
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
// differs.

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

function toKnowledgeEntry(knowledge: KnowledgeItem): RelatedEntry {
  return {
    id: knowledge.id,
    kind: "knowledge",
    title: knowledge.title,
    href: `/knowledge/${knowledge.slug}`,
    summary: knowledge.summary,
    meta: `${knowledgeCategoryLabels[knowledge.category]} · ${difficultyLabels[knowledge.difficulty]}`,
    tags: knowledge.tags
  };
}

function toSkillEntry(skill: SkillItem): RelatedEntry {
  return {
    id: skill.id,
    kind: "skill",
    title: skill.title,
    href: `/skills/${skill.slug}`,
    summary: skill.summary,
    meta: `${skillTypeLabels[skill.skillType]} · ${heatLabels[skill.heatLevel]}`,
    tags: skill.tags
  };
}

// The read-first chain can mix kinds, so its cards name the kind in the meta
// line; the link text is the one each kind's related cards already use.
const entryKindCopy = {
  skill: { label: "技能", linkText: "查看技能" },
  knowledge: { label: "知识", linkText: "查看概念" }
} as const;

export interface ContentDetailKind<TItem extends DetailItem> {
  kind: "skill" | "knowledge";
  /** 技能 / 知识 — the page title suffix. */
  noun: string;
  publicPath: string;
  sectionLabel: string;
  className: string;
  kicker: (item: TItem) => string;
  stamps: (item: TItem) => { label: string; muted?: boolean }[];
  leadHeading: string;
  graphHint: string;
  technologySection: { eyebrow: string; heading: string; noteLabel: string };
  /**
   * Knowledge only: the signals whose body links this page, minus the ones
   * technologySection already lists. Skills have no body links.
   */
  bodyMentions?: {
    eyebrow: string;
    heading: string;
    note: string;
    /** Appended when the section above lists any signal. */
    excludedNote: string;
    getRows: (item: TItem) => KnowledgeMentionRow[];
  };
  related: {
    eyebrow: string;
    heading: string;
    fallbackNote: string;
    linkText: string;
    countLabel: string;
    getEntries: (item: TItem) => RelatedEntry[];
  };
  asideLabel: string;
  profileKicker: string;
  profileRows: (item: TItem) => { label: string; value: string }[];
  readingPath: string;
}

export const skillDetailKind: ContentDetailKind<SkillItem> = {
  kind: "skill",
  noun: "技能",
  publicPath: "/skills",
  sectionLabel: "理解技能",
  className: "skill-detail-page dossier",
  kicker: (skill) => skillTypeLabels[skill.skillType],
  stamps: (skill) => [
    { label: heatLabels[skill.heatLevel] },
    { label: learningCostLabels[skill.learningCost], muted: true }
  ],
  leadHeading: "这项技能能帮你做什么",
  graphHint: "这项技能相邻的技术信号与背景概念，点击节点可继续探索。",
  technologySection: {
    eyebrow: "用已发布信号练习",
    heading: "这项技能有助于评估的技术信号",
    noteLabel: "为什么重要"
  },
  related: {
    eyebrow: "背景概念",
    heading: "与这项技能搭配的知识",
    fallbackNote: "理解这个概念，能帮你在解读新技术信号时更好地运用这项技能。",
    linkText: "查看概念",
    countLabel: "背景概念",
    getEntries: (skill) =>
      getAllKnowledge()
        .filter((knowledge) => skill.relatedKnowledgeIds.includes(knowledge.id))
        .map(toKnowledgeEntry)
  },
  asideLabel: "技能概览",
  profileKicker: "技能档案",
  profileRows: (skill) => [
    { label: "类别", value: skillTypeLabels[skill.skillType] },
    { label: "当前热度", value: heatLabels[skill.heatLevel] },
    { label: "学习成本", value: learningCostValues[skill.learningCost] }
  ],
  readingPath: "先读技能说明，打开一条相关信号，再用关联概念补齐背景。"
};

export const knowledgeDetailKind: ContentDetailKind<KnowledgeItem> = {
  kind: "knowledge",
  noun: "知识",
  publicPath: "/knowledge",
  sectionLabel: "背景知识",
  className: "skill-detail-page knowledge-detail-page dossier",
  kicker: (knowledge) => knowledgeCategoryLabels[knowledge.category],
  // The category is already the kicker; repeating it as the first chip
  // said the same thing twice, so the knowledge hero carries difficulty
  // only — as the skill hero carries type in the kicker and heat/cost in
  // the chips.
  stamps: (knowledge) => [
    { label: difficultyLabels[knowledge.difficulty], muted: true }
  ],
  leadHeading: "这个概念是什么意思",
  graphHint: "这个概念相邻的技术信号与相关技能，点击节点可继续探索。",
  technologySection: {
    eyebrow: "可解释",
    heading: "这个概念能解释的技术信号",
    noteLabel: "这个概念在这里如何体现"
  },
  bodyMentions: {
    eyebrow: "自动匹配",
    heading: "正文里提到它的信号",
    note: "按正文自动匹配，未经编辑挑选",
    excludedNote: "上一节已列出的不再重复",
    getRows: (knowledge) =>
      getKnowledgeMentions(
        knowledge.id,
        getAllTechnologies(),
        buildKnowledgeLinkTargets(getAllKnowledge()),
        knowledge.relatedTechnologyIds
      )
  },
  related: {
    eyebrow: "搭配技能",
    heading: "使用这个概念的技能",
    fallbackNote: "有了这个概念，这项技能会更容易练习和应用。",
    linkText: "查看技能",
    countLabel: "关联技能",
    getEntries: (knowledge) =>
      getAllSkills()
        .filter((skill) => knowledge.relatedSkillIds.includes(skill.id))
        .map(toSkillEntry)
  },
  asideLabel: "知识概览",
  profileKicker: "知识档案",
  profileRows: (knowledge) => [
    { label: "类别", value: knowledgeCategoryLabels[knowledge.category] },
    { label: "难度", value: difficultyLabels[knowledge.difficulty] }
  ],
  readingPath:
    "先从概念开始，打开一条相关信号，再用关联技能决定接下来评估什么。"
};

export function buildContentDetailMetadata<TItem extends DetailItem>(
  kind: ContentDetailKind<TItem>,
  slug: string,
  item: TItem | undefined
): Metadata {
  if (!item) {
    return buildPageMetadata({
      title: "没有这一页",
      path: `${kind.publicPath}/${slug}`,
      noIndex: true
    });
  }

  return buildPageMetadata({
    title: `${item.title} · ${kind.noun}`,
    description: item.summary,
    path: `${kind.publicPath}/${item.slug}`,
    type: "article",
    largeImage: true
  });
}

function RelatedCard({
  className,
  meta,
  relation,
  title,
  href,
  summary,
  note,
  tags,
  linkText
}: {
  className: string;
  meta: ReactNode;
  relation: { relationType: RelationType };
  title: string;
  href: string;
  summary: string;
  note?: { label?: string; text: string };
  tags: TopicTag[];
  linkText: string;
}) {
  return (
    <DossierCard className={className}>
      <div>
        <div className="skill-detail-related-card__toprow">
          <p className="skill-detail-related-card__meta">{meta}</p>
          <DossierStampTag>
            {getRelationTypeLabel(relation.relationType, "zh")}
          </DossierStampTag>
        </div>
        <h3>
          <Link href={href}>{title}</Link>
        </h3>
        <p>{summary}</p>
        {note ? (
          <DossierCatalogNote label={note.label}>
            {note.text}
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

function BodyMentionRow({ row }: { row: KnowledgeMentionRow }) {
  return (
    <li>
      <DossierRegisterRow
        title={row.title}
        date={row.publishDate}
        href={`/technologies/${row.slug}`}
        headingLevel={3}
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
  rows
}: {
  id: string;
  sharePath: string;
  eyebrow: string;
  heading: string;
  note: string;
  rows: KnowledgeMentionRow[];
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
          <BodyMentionRow key={row.id} row={row} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="knowledge-mentions__more" data-print="hide">
          <summary>再看 {rest.length} 条</summary>
          <ul className="knowledge-mentions__list">
            {rest.map((row) => (
              <BodyMentionRow key={row.id} row={row} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function ContentDetailPage<TItem extends DetailItem>({
  kind,
  item
}: {
  kind: ContentDetailKind<TItem>;
  item: TItem;
}) {
  const tags = getTagsByIds(item.tags);
  const sharePath = `${kind.publicPath}/${item.slug}`;
  const relatedTechnologies: TechnologyItem[] = getAllTechnologies().filter(
    (technology) => item.relatedTechnologyIds.includes(technology.id)
  );
  const allRelatedEntries = kind.related.getEntries(item);
  // `requires` 必备 prerequisites, deepest first. A direct prerequisite is
  // always one of the related entries (skills and knowledge only link across
  // kinds), so it moves up into 先读这些 rather than appearing twice with the
  // same note; the graph and the aside counts still include it.
  const prerequisites = getPrerequisiteChain(item.id).map((step) => ({
    step,
    entry:
      step.kind === "skill"
        ? toSkillEntry(step.item)
        : toKnowledgeEntry(step.item)
  }));
  const prerequisiteIds = new Set(prerequisites.map(({ step }) => step.id));
  const technologyRelations = relatedTechnologies.map((technology) =>
    findRelationBetween(item.id, kind.kind, technology.id, "technology")
  );
  const allEntryRelations = allRelatedEntries.map((entry) =>
    findRelationBetween(item.id, kind.kind, entry.id, entry.kind)
  );
  const relatedEntries = allRelatedEntries.filter(
    (entry) => !prerequisiteIds.has(entry.id)
  );
  const entryRelations = allEntryRelations.filter(
    (_, index) => !prerequisiteIds.has(allRelatedEntries[index].id)
  );
  const graphNodes: RelationshipGraphNode[] = [
    ...relatedTechnologies.map((technology, index) => ({
      title: getPreferredTechnologyTitle(technology),
      href: `/technologies/${technology.slug}`,
      kind: "technology" as const,
      relationLabel: getRelationTypeLabel(
        technologyRelations[index].relationType,
        "zh"
      ),
      note: technologyRelations[index].note
    })),
    ...allRelatedEntries.map((entry, index) => ({
      title: entry.title,
      href: entry.href,
      kind: entry.kind,
      relationLabel: getRelationTypeLabel(
        allEntryRelations[index].relationType,
        "zh"
      ),
      note: allEntryRelations[index].note
    }))
  ];
  const bodyMentionRows = kind.bodyMentions?.getRows(item) ?? [];
  // Same conditions the sections below render on, so the table lists exactly
  // what is on the page.
  const tocEntries = selectPageTocEntries(
    getContentDetailTocCandidates({
      kind: kind.kind,
      prerequisiteCount: prerequisites.length,
      hasBody: Boolean(item.content),
      graphNodeCount: graphNodes.length,
      relatedTechnologyCount: relatedTechnologies.length,
      bodyMentionCount: bodyMentionRows.length,
      relatedEntryCount: relatedEntries.length,
      headings: {
        body: kind.leadHeading,
        relatedTechnologies: kind.technologySection.heading,
        bodyMentions: kind.bodyMentions?.heading,
        relatedEntries: kind.related.heading
      }
    })
  );

  return (
    <UserPageShell
      title={item.title}
      description={item.summary}
      sectionLabel={kind.sectionLabel}
      showHeader={false}
      className={kind.className}
    >
      <div className="skill-detail-layout">
        <section className="skill-detail-hero">
          <p className="skill-detail-kicker">{kind.kicker(item)}</p>
          <h1>
            <UnbreakableTitle text={item.title} />
          </h1>
          <p>{item.summary}</p>
          <div className="skill-detail-hero__meta">
            <span>
              {formatReadingTime(
                estimateContentDetailReadingMinutes(item),
                "zh"
              )}
            </span>
            {kind.stamps(item).map((stamp) => (
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
                eyebrow="阅读顺序"
                heading="先读这些"
              >
                {prerequisites.map(({ step, entry }) => (
                  <RelatedCard
                    key={entry.id}
                    className="skill-detail-related-card skill-detail-related-card--knowledge"
                    meta={`${entryKindCopy[entry.kind].label} · ${entry.meta}`}
                    relation={{ relationType: "requires" }}
                    title={entry.title}
                    href={entry.href}
                    summary={entry.summary}
                    note={
                      step.note
                        ? {
                            label:
                              step.depth === 1
                                ? "为什么先读"
                                : `先于「${step.requiredByTitle}」`,
                            text: step.note
                          }
                        : undefined
                    }
                    tags={getTagsByIds(entry.tags)}
                    linkText={entryKindCopy[entry.kind].linkText}
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
                  {kind.leadHeading}
                </SectionHeading>
                <ContentBody body={item.content} />
              </section>
            ) : null}

            <RelationshipGraph
              centerTitle={item.title}
              centerId={item.id}
              nodes={graphNodes}
              sectionClassName="skill-detail-section"
              id={tocIds.graph}
              sharePath={sharePath}
              hint={kind.graphHint}
            />

            {relatedTechnologies.length > 0 ? (
              <RelatedSection
                id={tocIds.relatedTechnologies}
                sharePath={sharePath}
                eyebrow={kind.technologySection.eyebrow}
                heading={kind.technologySection.heading}
              >
                {relatedTechnologies.map((technology, index) => (
                  <RelatedCard
                    key={technology.id}
                    className="skill-detail-related-card"
                    meta={
                      <>
                        {`${technology.sourceName} · `}
                        {/* A date must not split at its hyphens (2026- / 07-15) on a narrow card. */}
                        <span className="nowrap-run">
                          {technology.publishDate}
                        </span>
                      </>
                    }
                    relation={technologyRelations[index]}
                    title={getPreferredTechnologyTitle(technology)}
                    href={`/technologies/${technology.slug}`}
                    summary={getPreferredTechnologySummary(technology)}
                    note={
                      technology.whyItMatters
                        ? {
                            label: kind.technologySection.noteLabel,
                            text: technology.whyItMatters
                          }
                        : undefined
                    }
                    tags={getTagsByIds(technology.tags)}
                    linkText="查看相关信号"
                  />
                ))}
              </RelatedSection>
            ) : null}

            {kind.bodyMentions && bodyMentionRows.length > 0 ? (
              <BodyMentionsSection
                id={tocIds.bodyMentions}
                sharePath={sharePath}
                eyebrow={kind.bodyMentions.eyebrow}
                heading={kind.bodyMentions.heading}
                note={
                  relatedTechnologies.length > 0
                    ? `${kind.bodyMentions.note}；${kind.bodyMentions.excludedNote}。`
                    : `${kind.bodyMentions.note}。`
                }
                rows={bodyMentionRows}
              />
            ) : null}

            {relatedEntries.length > 0 ? (
              <RelatedSection
                id={tocIds.relatedEntries[kind.kind]}
                sharePath={sharePath}
                eyebrow={kind.related.eyebrow}
                heading={kind.related.heading}
              >
                {relatedEntries.map((entry, index) => (
                  <RelatedCard
                    key={entry.id}
                    className="skill-detail-related-card skill-detail-related-card--knowledge"
                    meta={entry.meta}
                    relation={entryRelations[index]}
                    title={entry.title}
                    href={entry.href}
                    summary={entry.summary}
                    note={{
                      text:
                        entryRelations[index].note ?? kind.related.fallbackNote
                    }}
                    tags={getTagsByIds(entry.tags)}
                    linkText={kind.related.linkText}
                  />
                ))}
              </RelatedSection>
            ) : null}
          </main>

          <aside className="skill-detail-aside" aria-label={kind.asideLabel}>
            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">{kind.profileKicker}</p>
              <dl className="skill-detail-profile">
                {[
                  ...kind.profileRows(item),
                  { label: "技术信号", value: relatedTechnologies.length },
                  {
                    label: kind.related.countLabel,
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
                <p className="skill-detail-kicker">主题</p>
                <FollowableTagList tags={tags} />
              </section>
            ) : null}

            {/* How to move around the site: nothing to act on in print. */}
            <section className="skill-detail-aside-card" data-print="hide">
              <p className="skill-detail-kicker">阅读路径</p>
              <p>{kind.readingPath}</p>
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
