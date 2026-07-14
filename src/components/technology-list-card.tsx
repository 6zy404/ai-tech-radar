import Link from "next/link";

import { RelationDensity } from "@/components/relation-density";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
  getTechnologyWhyItMatters
} from "@/lib/content-intelligence";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText,
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
  const whyItMatters =
    getTechnologyWhyItMatters(technology, summary) ?? summary;
  const audience = getTechnologyAudience(technology).slice(0, 2);
  const difficultyLabel = getReadingDifficultyLabel(
    technology.readingDifficulty
  );
  const contextChips = [
    ...audience,
    difficultyLabel,
    ...tags.map((tag) => tag.name)
  ]
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
  const relationCounts = [
    { n: technology.relatedTechnologyIds?.length ?? 0, label: "技术" },
    { n: technology.relatedSkillIds.length, label: "技能" },
    { n: technology.relatedKnowledgeIds.length, label: "背景知识" }
  ];

  return (
    <article className="technology-card technology-signal-card user-content-card">
      <div className="technology-card__topline">
        <div className="technology-card__signal-row">
          <span className="technology-card__meta-pill">
            {getTechnologyTypeLabel(technology.type, effectiveMode)}
          </span>
          <span className={getPriorityLevelClass(ranking.priorityLevel)}>
            {getPriorityLevelLabel(ranking.priorityLevel, effectiveMode)}
          </span>
        </div>
        <p className="technology-card__source-line">
          <span>{technology.sourceName}</span>
          <span>{technology.publishDate}</span>
        </p>
      </div>

      <div className="technology-card__body">
        <h2>
          <Link href={`/technologies/${technology.slug}`}>{title}</Link>
        </h2>
        <p className="technology-card__summary">{summary}</p>

        <div className="technology-card__insight">
          <span>为什么重要</span>
          <p>{whyItMatters}</p>
        </div>

        <RelationDensity items={relationCounts} />

        <div className="technology-card__footer">
          {contextChips.length > 0 ? (
            <div className="technology-card__context-row">
              {contextChips.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}

          <Link
            href={`/technologies/${technology.slug}`}
            className="technology-card__open-link"
          >
            查看信号
          </Link>
        </div>
      </div>
    </article>
  );
}
