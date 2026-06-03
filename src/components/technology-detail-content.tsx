"use client";

import { useState } from "react";

import { MetadataRow } from "@/components/metadata-row";
import { RelatedItemsSection } from "@/components/related-items-section";
import { SourceReference } from "@/components/source-reference";
import { TagList } from "@/components/tag-list";
import { TechnologyLanguageIndicators } from "@/components/technology-language-indicators";
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
  getImportanceLevelLabel,
  getLocalizedTechnologyText,
  getPublisherTypeLabel,
  getTechnologyAudienceLabel,
  getTechnologyRelationNote,
  getRelationTypeLabel,
  getTechnologySignalLabel,
  getTechnologyDefaultMode,
  getTechnologyDetailCopy,
  getTechnologyTranslationCoverage,
  getTechnologyTranslationMessage,
  getTechnologyTypeLabel,
  hasTechnologyChineseContent,
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
  relatedSkills: RelationListItem[];
  relatedKnowledge: RelationListItem[];
}

export function TechnologyDetailContent({
  technology,
  tags,
  relatedSkills,
  relatedKnowledge
}: TechnologyDetailContentProps) {
  const hasAnyChinese = hasTechnologyChineseContent(technology);
  const hasDetailChinese = hasTechnologyChineseContentForContext(
    technology,
    "detail"
  );
  const translationCoverage = getTechnologyTranslationCoverage(
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
  const content = getLocalizedTechnologyText(
    technology.content,
    mode,
    technology.sourceLanguage
  );
  const signalLabel = getTechnologySignalLabel(
    technology.importanceLevel,
    mode
  );
  const audienceLabel = getTechnologyAudienceLabel(technology.type, mode);
  const translationMessage = getTechnologyTranslationMessage(
    mode,
    hasAnyChinese,
    hasDetailChinese
  );
  const prioritySummary = getPriorityUserSummary(ranking, mode);
  const whyItMatters = getTechnologyWhyItMatters(technology, prioritySummary);
  const audienceItems = getTechnologyAudience(technology);
  const impactAreas = getTechnologyImpactAreas(technology);
  const learningPath = getTechnologyLearningPath(technology);
  const followUpQuestions = getTechnologyFollowUpQuestions(technology);
  const technicalContext = technology.technicalContext?.trim();
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

  return (
    <UserArticleLayout
      hero={
        <section className="user-article-hero">
          <div className="user-article-hero__copy">
            <p className="eyebrow user-eyebrow">
              {getTechnologyTypeLabel(technology.type, mode)}
            </p>
            <h1>{title}</h1>
            <p className="user-article-hero__summary">{summary}</p>
            <div className="user-article-hero__signal">
              <span>{copy.whyItMattersLabel}</span>
              <strong>{signalLabel}</strong>
              <p>{audienceLabel}</p>
            </div>
            <div className="user-article-hero__priority">
              <span className={getPriorityLevelClass(ranking.priorityLevel)}>
                {getPriorityLevelLabel(ranking.priorityLevel, mode)}
              </span>
              <p>{prioritySummary}</p>
            </div>
            <MetadataRow
              className="metadata-row--article"
              items={[
                { label: copy.sourceNameLabel, value: technology.sourceName },
                { label: copy.publishedLabel, value: technology.publishDate },
                {
                  label: copy.publisherTypeLabel,
                  value: getPublisherTypeLabel(technology.publisherType, mode)
                },
                {
                  label: copy.importanceLabel,
                  value: getImportanceLevelLabel(technology.importanceLevel, mode)
                }
              ]}
            />
          </div>

          <TechnologyLanguageSwitch
            mode={mode}
            onChange={setRequestedMode}
            chineseEnabled={hasDetailChinese}
            label={copy.switchLabel}
          />
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
            <h2>{copy.languageStateLabel}</h2>
            <div className="tag-row">
              <TechnologyLanguageIndicators
                technology={technology}
                mode={mode}
                context="detail"
              />
            </div>
          </section>

          <section className="user-reference-panel">
            <h2>{mode === "zh" ? "关注优先级" : "Priority"}</h2>
            <p className="user-reference-panel__copy">
              {prioritySummary}
            </p>
          </section>

          {tags.length > 0 ? (
            <section className="user-reference-panel">
              <h2>{copy.tagsLabel}</h2>
              <TagList tags={tags} />
            </section>
          ) : null}
        </>
      }
    >
      <p
        className={`translation-note user-article-note${
          translationCoverage === "none" || translationCoverage === "partial"
            ? " translation-note--warning"
            : ""
        }`}
      >
        {translationMessage}
      </p>

      {whyItMatters ||
      technicalContext ||
      audienceItems.length > 0 ||
      impactAreas.length > 0 ||
      readingDifficultyLabel ? (
        <section className="user-article-section content-intelligence-overview">
          <h2>Understand this signal</h2>
          <div className="content-intelligence-grid">
            {whyItMatters ? (
              <article className="content-intelligence-card">
                <span>Why it matters</span>
                <p>{whyItMatters}</p>
              </article>
            ) : null}

            {technicalContext ? (
              <article className="content-intelligence-card">
                <span>Technical context</span>
                <p>{technicalContext}</p>
              </article>
            ) : null}

            {audienceItems.length > 0 ? (
              <article className="content-intelligence-card">
                <span>Who should care</span>
                <div className="content-intelligence-pill-row">
                  {audienceItems.map((item) => (
                    <span key={item} className="content-intelligence-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {impactAreas.length > 0 || readingDifficultyLabel ? (
              <article className="content-intelligence-card">
                <span>Impact and difficulty</span>
                {readingDifficultyLabel ? <p>{readingDifficultyLabel}</p> : null}
                {impactAreas.length > 0 ? (
                  <div className="content-intelligence-pill-row">
                    {impactAreas.map((item) => (
                      <span key={item} className="content-intelligence-pill">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="user-article-section user-article-section--lead">
        <h2>{copy.detailHeading}</h2>
        <p>{content}</p>
      </section>

      {learningPath.length > 0 ? (
        <section className="user-article-section content-intelligence-sequence">
          <h2>Learning path</h2>
          <ol className="content-intelligence-list">
            {learningPath.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <RelatedItemsSection
        title={copy.relatedSkillsTitle}
        description={copy.relatedSkillsDescription}
        emptyText={copy.relatedSkillsEmpty}
        items={localizedRelatedSkills}
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      <RelatedItemsSection
        title={copy.relatedKnowledgeTitle}
        description={copy.relatedKnowledgeDescription}
        emptyText={copy.relatedKnowledgeEmpty}
        items={localizedRelatedKnowledge}
        formatRelationType={(relationType) =>
          getRelationTypeLabel(relationType, mode)
        }
      />

      {followUpQuestions.length > 0 ? (
        <section className="user-article-section content-intelligence-sequence">
          <h2>Follow-up questions</h2>
          <ul className="content-intelligence-list">
            {followUpQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </UserArticleLayout>
  );
}
