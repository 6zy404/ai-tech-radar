"use client";

import { useState } from "react";

import { DossierRegisterRow } from "@/components/dossier-register-row";
import { DossierRelatedItemsSection } from "@/components/dossier-related-items-section";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import {
  RelationshipGraph,
  type RelationshipGraphNode
} from "@/components/relationship-graph";
import { FollowableTagList } from "@/components/followable-tag-list";
import { IssuePager } from "@/components/issue-pager";
import { PageToc } from "@/components/page-toc";
import { SourceReference } from "@/components/source-reference";
import { TagList } from "@/components/tag-list";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { TechnologyCompareWidget } from "@/components/technology-compare-widget";
import { TechnologyExplainWidget } from "@/components/technology-explain-widget";
import { TechnologyLearningPathWidget } from "@/components/technology-learning-path-widget";
import { ContentBody } from "@/components/content-body";
import { CopyLinkButton } from "@/components/copy-link-button";
import { SectionHeading } from "@/components/section-link";
import { TechnologyEvolutionLine } from "@/components/technology-evolution-line";
import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { UserArticleLayout } from "@/components/user-article-layout";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
  getTechnologyFollowUpQuestions,
  getTechnologyImpactAreas,
  getTechnologyKnowledgeExplanation,
  getTechnologyLearningPath,
  getTechnologySkillExplanation,
  getTechnologyWhyItMatters
} from "@/lib/content-intelligence";
import {
  getTechnologyTocCandidates,
  selectPageTocEntries,
  technologyTocIds as tocIds
} from "@/lib/page-toc";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { estimateReadingMinutes, formatReadingTime } from "@/lib/reading-time";
import { getSourceDirectoryHref } from "@/lib/source-directory";
// Type-only: the module reads the digest store, which a client component
// must not bundle. The data arrives as a prop from the server page.
import type {
  SignalIssueAppearances,
  SignalIssueSection
} from "@/lib/signal-digest-appearances";
// Type-only for the same reason: the module reads the published pool.
import type { SignalNeighbors } from "@/lib/signal-neighbors";
import type { SimilarSignalLink } from "@/lib/similar-signals";
import type { TechnologyEvolutionChain } from "@/lib/technology-evolution";
import {
  getPriorityLevelLabel,
  getPriorityUserSummary
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText,
  getPublisherTypeLabel,
  getRelationTypeLabel,
  getTechnologyDefaultMode,
  getTechnologyDetailCopy,
  getTechnologyRelationNote,
  getTechnologyTypeLabel,
  hasTechnologyChineseContentForContext,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type {
  RelationListItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

// The section headings as the digest and weekly pages print them, minus 今日.
const issueSectionLabels: Record<SignalIssueSection, string> = {
  high_priority: "立即关注",
  watch: "值得跟踪"
};

interface TechnologyDetailContentProps {
  technology: TechnologyItem;
  tags: TopicTag[];
  relatedTechnologies: RelationListItem[];
  relatedSkills: RelationListItem[];
  relatedKnowledge: RelationListItem[];
  compareCandidates: { id: string; title: string; href: string }[];
  evolutionChain?: TechnologyEvolutionChain;
  /** Omitted by the workspace preview: drafts are not in the embedded pool. */
  similarSignals?: SimilarSignalLink[];
  /** Omitted by the workspace preview: a draft is in no published issue. */
  issueAppearances?: SignalIssueAppearances;
  /** Omitted by the workspace preview: a draft has no place in the list. */
  neighbors?: SignalNeighbors;
}

export function TechnologyDetailContent({
  technology,
  tags,
  relatedTechnologies,
  relatedSkills,
  relatedKnowledge,
  compareCandidates,
  evolutionChain,
  similarSignals = [],
  issueAppearances,
  neighbors
}: TechnologyDetailContentProps) {
  const hasDetailChinese = hasTechnologyChineseContentForContext(
    technology,
    "detail"
  );
  const [requestedMode, setRequestedMode] = useState<TechnologyContentMode>(
    getTechnologyDefaultMode(technology, "detail")
  );
  const mode = getEffectiveTechnologyMode(technology, requestedMode, "detail");
  const copy = getTechnologyDetailCopy(mode);
  const ranking = evaluateTechnologyPriority(technology);
  // The workspace preview renders drafts through this component: a draft has
  // no public address to copy, so it gets neither 复制链接 nor the 「#」s.
  const sharePath =
    technology.status === "published"
      ? `/technologies/${technology.slug}`
      : undefined;
  // The same rule for the publisher's /sources card: a draft's publisher may
  // have no published signal, and so no card to land on.
  const publisherHref =
    technology.status === "published" && technology.publisherName?.trim()
      ? getSourceDirectoryHref(technology.publisherName)
      : undefined;

  const title = getLocalizedTechnologyText(
    technology.title,
    mode,
    technology.sourceLanguage
  );
  const summary = getLocalizedTechnologyText(
    technology.summary,
    mode,
    technology.sourceLanguage
  );
  const priorityLabel = getPriorityLevelLabel(ranking.priorityLevel, mode);
  const publisherTypeLabel = getPublisherTypeLabel(
    technology.publisherType,
    mode
  );
  const prioritySummary = getPriorityUserSummary(ranking, mode);
  const body = getLocalizedTechnologyText(
    technology.content,
    mode,
    technology.sourceLanguage
  ).trim();
  const whyItMatters = getTechnologyWhyItMatters(technology, prioritySummary);
  const technicalContext = technology.technicalContext?.trim();
  const audienceItems = getTechnologyAudience(technology);
  const impactAreas = getTechnologyImpactAreas(technology);
  const learningPath = getTechnologyLearningPath(technology);
  const followUpQuestions = getTechnologyFollowUpQuestions(technology);
  // Only the reading column's own prose: the hero summary, the body and the
  // editorial sections below it, each in the language it is shown in right
  // now. Chips, relation notes and the AI widgets (empty until a reader asks)
  // are not counted.
  const readingTimeLabel = formatReadingTime(
    estimateReadingMinutes(body, [
      summary,
      whyItMatters ?? "",
      technicalContext ?? "",
      ...learningPath,
      ...followUpQuestions
    ]),
    mode
  );
  const readingDifficultyLabel = getReadingDifficultyLabel(
    technology.readingDifficulty
  );
  const localizedRelatedSkills = relatedSkills.map((item, index) => ({
    ...item,
    note: getTechnologyRelationNote(
      getTechnologySkillExplanation(
        technology,
        technology.relatedSkillIds[index] ?? "",
        item.note
      ),
      mode
    )
  }));
  const localizedRelatedKnowledge = relatedKnowledge.map((item, index) => ({
    ...item,
    note: getTechnologyRelationNote(
      getTechnologyKnowledgeExplanation(
        technology,
        technology.relatedKnowledgeIds[index] ?? "",
        item.note
      ),
      mode
    )
  }));
  const graphNodes: RelationshipGraphNode[] = [
    ...relatedTechnologies.map((item) => ({
      title: item.title,
      href: item.href,
      kind: "technology" as const,
      relationLabel: getRelationTypeLabel(item.relationType, mode),
      note: item.note
    })),
    ...localizedRelatedSkills.map((item) => ({
      title: item.title,
      href: item.href,
      kind: "skill" as const,
      relationLabel: getRelationTypeLabel(item.relationType, mode),
      note: item.note
    })),
    ...localizedRelatedKnowledge.map((item) => ({
      title: item.title,
      href: item.href,
      kind: "knowledge" as const,
      relationLabel: getRelationTypeLabel(item.relationType, mode),
      note: item.note
    }))
  ];
  // Same conditions the sections below render on, so the table lists exactly
  // what is on the page.
  const tocEntries = selectPageTocEntries(
    getTechnologyTocCandidates({
      hasEvolution: Boolean(evolutionChain),
      hasBody: Boolean(body),
      hasWhyItMatters: Boolean(whyItMatters),
      hasTechnicalContext: Boolean(technicalContext),
      hasAudience: audienceItems.length > 0 || impactAreas.length > 0,
      learningPathCount: learningPath.length,
      graphNodeCount: graphNodes.length,
      relatedTechnologyCount: relatedTechnologies.length,
      similarSignalCount: similarSignals.length,
      relatedSkillCount: localizedRelatedSkills.length,
      relatedKnowledgeCount: localizedRelatedKnowledge.length,
      followUpQuestionCount: followUpQuestions.length,
      digestAppearanceCount: issueAppearances?.digests.length ?? 0
    })
  );

  return (
    <UserArticleLayout
      className="dossier technology-detail-reading"
      hero={
        <section className="user-article-hero technology-detail-hero">
          <div className="user-article-hero__copy technology-detail-hero__copy">
            <div className="technology-detail-hero__topline">
              <span className="dossier-technology-card__catalog">
                {getTechnologyTypeLabel(technology.type, mode)} · 第{" "}
                {technology.publishDate} 号
              </span>
              <TechnologyLanguageSwitch
                mode={mode}
                onChange={setRequestedMode}
                chineseEnabled={hasDetailChinese}
              />
            </div>

            <h1>
              <UnbreakableTitle text={title} />
            </h1>
            <p className="user-article-hero__summary">{summary}</p>

            <div className="technology-detail-hero__meta">
              <span>{technology.sourceName}</span>
              <span>{technology.publishDate}</span>
              <span>{readingTimeLabel}</span>
              <DossierStampTag>{priorityLabel}</DossierStampTag>
              {sharePath ? <CopyLinkButton sharePath={sharePath} /> : null}
            </div>

            <p className="technology-detail-hero__priority-copy">
              {prioritySummary}
            </p>

            <TagList
              tags={tags}
              limit={4}
              className="technology-detail-hero__tags"
            />
          </div>
        </section>
      }
      aside={
        <>
          <SourceReference
            title={copy.sourceTitle}
            sourceName={technology.sourceName}
            sourceUrl={technology.sourceUrl}
            publisherName={technology.publisherName}
            publisherHref={publisherHref}
            publisherTypeLabel={publisherTypeLabel}
            publishDate={technology.publishDate}
            linkLabel={copy.sourceLinkLabel}
          />

          {/* The hero already prints this label and sentence. */}
          <section className="user-reference-panel" data-print="hide">
            <p className="eyebrow user-eyebrow">优先级</p>
            <h2>{priorityLabel}</h2>
            <p className="user-reference-panel__copy">{prioritySummary}</p>
          </section>

          {readingDifficultyLabel ? (
            <section className="user-reference-panel">
              <p className="eyebrow user-eyebrow">阅读难度</p>
              <h2>{readingDifficultyLabel}</h2>
            </section>
          ) : null}

          {tags.length > 0 ? (
            <section className="user-reference-panel">
              <p className="eyebrow user-eyebrow">{copy.tagsLabel}</p>
              <FollowableTagList tags={tags} />
            </section>
          ) : null}

          <PageToc entries={tocEntries} className="user-reference-panel" />
        </>
      }
    >
      <PageToc entries={tocEntries} variant="disclosure" />

      {evolutionChain ? (
        <TechnologyEvolutionLine
          chain={evolutionChain}
          id={tocIds.evolution}
          sharePath={sharePath}
        />
      ) : null}

      {body ? (
        <section
          id={tocIds.body}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">记录</p>
          <SectionHeading sectionId={tocIds.body} sharePath={sharePath}>
            信号正文
          </SectionHeading>
          <ContentBody body={body} />
        </section>
      ) : null}

      {whyItMatters ? (
        <section
          id={tocIds.whyItMatters}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">为什么是现在</p>
          <SectionHeading sectionId={tocIds.whyItMatters} sharePath={sharePath}>
            为什么重要
          </SectionHeading>
          <p className="technology-detail-section__lede">{whyItMatters}</p>
        </section>
      ) : null}

      {technicalContext ? (
        <section
          id={tocIds.technicalContext}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">背景</p>
          <SectionHeading
            sectionId={tocIds.technicalContext}
            sharePath={sharePath}
          >
            技术背景
          </SectionHeading>
          <p className="technology-detail-section__lede">{technicalContext}</p>
        </section>
      ) : null}

      <TechnologyExplainWidget technology={technology} />

      {audienceItems.length > 0 || impactAreas.length > 0 ? (
        <section
          id={tocIds.audience}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">关注人群</p>
          <SectionHeading sectionId={tocIds.audience} sharePath={sharePath}>
            谁该关注
          </SectionHeading>
          {audienceItems.length > 0 ? (
            <div className="technology-detail-chip-row">
              {audienceItems.map((item) => (
                <DossierStampTag
                  key={item}
                  className="dossier-stamp-tag--muted"
                >
                  {item}
                </DossierStampTag>
              ))}
            </div>
          ) : null}
          {impactAreas.length > 0 ? (
            <div className="technology-detail-impact">
              <span>可能影响的领域</span>
              <div className="technology-detail-chip-row">
                {impactAreas.map((item) => (
                  <DossierStampTag
                    key={item}
                    className="dossier-stamp-tag--muted"
                  >
                    {item}
                  </DossierStampTag>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {learningPath.length > 0 ? (
        <section
          id={tocIds.learningPath}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">下一步</p>
          <SectionHeading sectionId={tocIds.learningPath} sharePath={sharePath}>
            学习路径
          </SectionHeading>
          <ol className="technology-detail-learning-list">
            {learningPath.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <TechnologyLearningPathWidget technology={technology} />

      <RelationshipGraph
        id={tocIds.graph}
        sharePath={sharePath}
        centerTitle={title}
        centerId={technology.status === "published" ? technology.id : undefined}
        nodes={graphNodes}
        heading="在技术网络中的位置"
        hint="当前技术与相邻技术、技能和背景知识的连接，点击节点可继续探索。"
      />

      <DossierRelatedItemsSection
        id={tocIds.relatedTechnologies}
        sharePath={sharePath}
        title="相关技术"
        description="与该信号在工作流或主题上相邻的其他技术，可顺着这条线继续了解。"
        items={relatedTechnologies}
        linkLabel="查看技术"
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      <DossierRelatedItemsSection
        id={tocIds.similarSignals}
        sharePath={sharePath}
        title="内容相近的信号"
        description="按内容自动匹配，未经编辑挑选；已在相关技术和版本脉络里的不再重复。"
        items={similarSignals.map((item) => ({
          id: item.id,
          title: item.title,
          href: item.href,
          relationType: "related-to" as const,
          note: item.summary ?? ""
        }))}
        linkLabel="查看信号"
        formatRelationType={() => "自动匹配"}
      />

      <TechnologyCompareWidget
        technology={technology}
        candidates={compareCandidates}
      />

      <DossierRelatedItemsSection
        id={tocIds.relatedSkills}
        sharePath={sharePath}
        title={copy.relatedSkillsTitle}
        description={copy.relatedSkillsDescription}
        items={localizedRelatedSkills}
        linkLabel="查看技能"
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      <DossierRelatedItemsSection
        id={tocIds.relatedKnowledge}
        sharePath={sharePath}
        title={copy.relatedKnowledgeTitle}
        description={copy.relatedKnowledgeDescription}
        items={localizedRelatedKnowledge}
        linkLabel="查看概念"
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      {followUpQuestions.length > 0 ? (
        <section
          id={tocIds.followUpQuestions}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">延伸思考</p>
          <SectionHeading
            sectionId={tocIds.followUpQuestions}
            sharePath={sharePath}
          >
            后续问题
          </SectionHeading>
          <ul className="technology-detail-question-list">
            {followUpQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The signal's publication record, beside the one for its source:
          which briefs carried it, then the review of its week. */}
      {issueAppearances && issueAppearances.digests.length > 0 ? (
        <section
          id={tocIds.digestAppearances}
          className="user-article-section technology-detail-section signal-issue-appearances"
        >
          <p className="technology-detail-section__eyebrow">发布记录</p>
          <SectionHeading
            sectionId={tocIds.digestAppearances}
            sharePath={sharePath}
          >
            收录于
          </SectionHeading>
          <p className="signal-issue-appearances__note">
            收录这条信号的技术简报，新的在前
            {issueAppearances.weekly ? "；最后一行是它那一周的周回顾" : ""}
            。标签是它在那一期所在的栏目。
          </p>
          <ol className="signal-issue-appearances__list">
            {issueAppearances.digests.map((digest) => (
              <li key={digest.date}>
                <DossierRegisterRow
                  // A title that already names the date (every issue so
                  // far) would print it twice.
                  date={
                    digest.title.includes(digest.date) ? undefined : digest.date
                  }
                  title={digest.title}
                  href={digest.href}
                  tag={issueSectionLabels[digest.section]}
                  headingLevel={3}
                />
              </li>
            ))}
            {issueAppearances.weekly ? (
              <li>
                <DossierRegisterRow
                  title={`周回顾 · ${issueAppearances.weekly.rangeLabel}`}
                  href={issueAppearances.weekly.href}
                  tag={issueSectionLabels[issueAppearances.weekly.section]}
                  headingLevel={3}
                />
              </li>
            ) : null}
          </ol>
        </section>
      ) : null}

      <SourceReference
        title="来源参考"
        sourceName={technology.sourceName}
        sourceUrl={technology.sourceUrl}
        publisherName={technology.publisherName}
        publisherHref={publisherHref}
        publisherTypeLabel={publisherTypeLabel}
        publishDate={technology.publishDate}
        linkLabel={copy.sourceLinkLabel}
        showUrl
      />

      {/* Last, as on the digest page: the article ends with its source, and
          the pager leads away from it. Publish order, as in the 精选 list —
          not the 版本脉络 line. ← is the older signal, as ← 上一期 is the
          older issue on the digest and weekly pages. */}
      {neighbors ? (
        <IssuePager
          unit="条"
          ariaLabel="信号翻页"
          previous={
            neighbors.older
              ? {
                  href: `/technologies/${neighbors.older.slug}`,
                  label: neighbors.older.title
                }
              : undefined
          }
          next={
            neighbors.newer
              ? {
                  href: `/technologies/${neighbors.newer.slug}`,
                  label: neighbors.newer.title
                }
              : undefined
          }
        />
      ) : null}
    </UserArticleLayout>
  );
}
