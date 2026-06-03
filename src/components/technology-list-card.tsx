import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { TagList } from "@/components/tag-list";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
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
  getTechnologyAudienceLabel,
  getTechnologySignalLabel,
  getTechnologyTypeLabel,
  type TechnologyContentContext,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface TechnologyListCardProps {
  technology: TechnologyItem;
  tags: TopicTag[];
  mode: TechnologyContentMode;
  context?: TechnologyContentContext;
}

export function TechnologyListCard({
  technology,
  tags,
  mode,
  context = "preview"
}: TechnologyListCardProps) {
  const effectiveMode = getEffectiveTechnologyMode(technology, mode, context);
  const title = getLocalizedTechnologyText(
    technology.title,
    effectiveMode,
    technology.sourceLanguage
  );
  const summary = getLocalizedTechnologyText(
    technology.summary,
    effectiveMode,
    technology.sourceLanguage
  );
  const ranking = evaluateTechnologyPriority(technology);
  const signalLabel = getTechnologySignalLabel(
    technology.importanceLevel,
    effectiveMode
  );
  const audienceLabel = getTechnologyAudienceLabel(
    technology.type,
    effectiveMode
  );
  const intelligenceAudience = getTechnologyAudience(technology).slice(0, 2);
  const audienceDisplay =
    intelligenceAudience.length > 0
      ? effectiveMode === "zh"
        ? `适合 ${intelligenceAudience.join("、")} 关注`
        : `For ${intelligenceAudience.join(", ")}`
      : audienceLabel;
  const whyWatchText = getTechnologyWhyItMatters(technology, summary) ?? summary;
  const difficultyLabel = getReadingDifficultyLabel(technology.readingDifficulty);
  const whyWatchLabel = effectiveMode === "zh" ? "为什么值得看" : "Why watch";
  const contextItems = [
    technology.relatedSkillIds.length > 0
      ? effectiveMode === "zh"
        ? `${technology.relatedSkillIds.length} 个相关技能`
        : `${technology.relatedSkillIds.length} related skills`
      : null,
    technology.relatedKnowledgeIds.length > 0
      ? effectiveMode === "zh"
        ? `${technology.relatedKnowledgeIds.length} 个背景知识`
        : `${technology.relatedKnowledgeIds.length} knowledge links`
      : null,
    difficultyLabel
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="technology-card user-content-card">
      <div className="technology-card__meta user-content-card__meta">
        <div className="technology-card__signal-row">
          <span className="technology-card__meta-pill">
            {getTechnologyTypeLabel(technology.type, effectiveMode)}
          </span>
          <span className={getPriorityLevelClass(ranking.priorityLevel)}>
            {getPriorityLevelLabel(ranking.priorityLevel, effectiveMode)}
          </span>
          <span className="technology-card__signal-pill">{signalLabel}</span>
        </div>
        <MetadataRow
          className="technology-card__source-row"
          items={[
            { value: technology.sourceName },
            { value: technology.publishDate }
          ]}
        />
      </div>

      <div className="technology-card__body">
        <div className="technology-card__headline">
          <h2>
            <Link href={`/technologies/${technology.slug}`}>{title}</Link>
          </h2>
          <p className="technology-card__audience">{audienceDisplay}</p>
          <p className="technology-card__summary">{summary}</p>
          <div className="technology-card__insight">
            <span>{whyWatchLabel}</span>
            <p>{whyWatchText}</p>
          </div>
          <p className="technology-card__priority-summary">
            {getPriorityUserSummary(ranking, effectiveMode)}
          </p>
        </div>

        <div className="technology-card__footer">
          {contextItems.length > 0 ? (
            <div className="technology-card__context-row">
              {contextItems.slice(0, 3).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}

          <TagList tags={tags} limit={3} className="technology-card__tag-row" />
        </div>
      </div>
    </article>
  );
}
