"use client";

import { useState } from "react";

import { RelatedItemsSection } from "@/components/related-items-section";
import {
  RelationshipGraph,
  type RelationshipGraphNode
} from "@/components/relationship-graph";
import { FollowableTagList } from "@/components/followable-tag-list";
import { SourceReference } from "@/components/source-reference";
import { TagList } from "@/components/tag-list";
import { TechnologyCompareWidget } from "@/components/technology-compare-widget";
import { TechnologyExplainWidget } from "@/components/technology-explain-widget";
import { TechnologyLearningPathWidget } from "@/components/technology-learning-path-widget";
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
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel,
  getPriorityUserSummary
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText,
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

interface TechnologyDetailContentProps {
  technology: TechnologyItem;
  tags: TopicTag[];
  relatedTechnologies: RelationListItem[];
  relatedSkills: RelationListItem[];
  relatedKnowledge: RelationListItem[];
  compareCandidates: { id: string; title: string; href: string }[];
}

export function TechnologyDetailContent({
  technology,
  tags,
  relatedTechnologies,
  relatedSkills,
  relatedKnowledge,
  compareCandidates
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
  const prioritySummary = getPriorityUserSummary(ranking, mode);
  const whyItMatters = getTechnologyWhyItMatters(technology, prioritySummary);
  const technicalContext = technology.technicalContext?.trim();
  const audienceItems = getTechnologyAudience(technology);
  const impactAreas = getTechnologyImpactAreas(technology);
  const learningPath = getTechnologyLearningPath(technology);
  const followUpQuestions = getTechnologyFollowUpQuestions(technology);
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

  return (
    <UserArticleLayout
      className="technology-detail-reading"
      hero={
        <section className="user-article-hero technology-detail-hero">
          <div className="user-article-hero__copy technology-detail-hero__copy">
            <div className="technology-detail-hero__topline">
              <p className="eyebrow user-eyebrow">
                {getTechnologyTypeLabel(technology.type, mode)}
              </p>
              <TechnologyLanguageSwitch
                mode={mode}
                onChange={setRequestedMode}
                chineseEnabled={hasDetailChinese}
                label={copy.switchLabel}
                compact
              />
            </div>

            <h1>{title}</h1>
            <p className="user-article-hero__summary">{summary}</p>

            <div className="technology-detail-hero__meta">
              <span>{technology.sourceName}</span>
              <span>{technology.publishDate}</span>
              <span className={getPriorityLevelClass(ranking.priorityLevel)}>
                {priorityLabel}
              </span>
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
            publishDate={technology.publishDate}
            linkLabel={copy.sourceLinkLabel}
          />

          <section className="user-reference-panel">
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
        </>
      }
    >
      {whyItMatters ? (
        <section className="user-article-section technology-detail-section">
          <p className="technology-detail-section__eyebrow">为什么是现在</p>
          <h2>为什么重要</h2>
          <p className="technology-detail-section__lede">{whyItMatters}</p>
        </section>
      ) : null}

      {technicalContext ? (
        <section className="user-article-section technology-detail-section">
          <p className="technology-detail-section__eyebrow">背景</p>
          <h2>技术背景</h2>
          <p className="technology-detail-section__lede">{technicalContext}</p>
        </section>
      ) : null}

      <TechnologyExplainWidget technology={technology} />

      {audienceItems.length > 0 || impactAreas.length > 0 ? (
        <section className="user-article-section technology-detail-section">
          <p className="technology-detail-section__eyebrow">关注人群</p>
          <h2>谁该关注</h2>
          {audienceItems.length > 0 ? (
            <div className="technology-detail-chip-row">
              {audienceItems.map((item) => (
                <span key={item} className="technology-detail-chip">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          {impactAreas.length > 0 ? (
            <div className="technology-detail-impact">
              <span>可能影响的领域</span>
              <div className="technology-detail-chip-row">
                {impactAreas.map((item) => (
                  <span key={item} className="technology-detail-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {learningPath.length > 0 ? (
        <section className="user-article-section technology-detail-section">
          <p className="technology-detail-section__eyebrow">下一步</p>
          <h2>学习路径</h2>
          <ol className="technology-detail-learning-list">
            {learningPath.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <TechnologyLearningPathWidget technology={technology} />

      <RelationshipGraph
        centerTitle={title}
        nodes={graphNodes}
        heading="在技术网络中的位置"
        hint="当前技术与相邻技术、技能和背景知识的连接，点击节点可继续探索。"
      />

      <RelatedItemsSection
        title="相关技术"
        description="与该信号在工作流或主题上相邻的其他技术，可顺着这条线继续了解。"
        emptyText="暂无相关技术。"
        items={relatedTechnologies}
        linkLabel="查看技术"
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      <TechnologyCompareWidget
        technology={technology}
        candidates={compareCandidates}
      />

      <RelatedItemsSection
        title={copy.relatedSkillsTitle}
        description={copy.relatedSkillsDescription}
        emptyText={copy.relatedSkillsEmpty}
        items={localizedRelatedSkills}
        linkLabel="查看技能"
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      <RelatedItemsSection
        title={copy.relatedKnowledgeTitle}
        description={copy.relatedKnowledgeDescription}
        emptyText={copy.relatedKnowledgeEmpty}
        items={localizedRelatedKnowledge}
        linkLabel="查看概念"
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      {followUpQuestions.length > 0 ? (
        <section className="user-article-section technology-detail-section">
          <p className="technology-detail-section__eyebrow">延伸思考</p>
          <h2>后续问题</h2>
          <ul className="technology-detail-question-list">
            {followUpQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <SourceReference
        title="来源参考"
        sourceName={technology.sourceName}
        sourceUrl={technology.sourceUrl}
        publisherName={technology.publisherName}
        publishDate={technology.publishDate}
        linkLabel={copy.sourceLinkLabel}
        showUrl
      />
    </UserArticleLayout>
  );
}
