import Link from "next/link";
import type { ReactNode } from "react";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
  getTechnologyWhyItMatters
} from "@/lib/content-intelligence";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText,
  getTechnologyTypeLabel,
  type TechnologyContentContext,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface DossierTechnologyCardProps {
  technology: TechnologyItem;
  tags: TopicTag[];
  mode: TechnologyContentMode;
  context?: TechnologyContentContext;
  /** Dims the card once the reader marked the signal read (P4 v0.4). */
  isRead?: boolean;
  /** The 稍后读 / 已读 toggles; omitted on surfaces without reading state. */
  readingActions?: ReactNode;
}

/**
 * Dossier-direction index card for the /technologies signal stream. A
 * page-specific sibling of TechnologyListCard (kept unchanged, since it is
 * still shared with the home page and /radar) rather than a variant prop, so
 * this migration cannot regress those still-teal surfaces.
 */
export function DossierTechnologyCard({
  technology,
  tags,
  mode,
  context = "preview",
  isRead = false,
  readingActions
}: DossierTechnologyCardProps) {
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

  return (
    <DossierCard
      className={`dossier-technology-card${
        isRead ? " dossier-technology-card--read" : ""
      }`}
    >
      <div className="dossier-technology-card__topline">
        <span className="dossier-technology-card__catalog">
          {getTechnologyTypeLabel(technology.type, effectiveMode)} · 第{" "}
          {technology.publishDate} 号
        </span>
        {isRead ? (
          <DossierStampTag className="dossier-technology-card__read-stamp">
            已读
          </DossierStampTag>
        ) : null}
        <DossierStampTag>
          {getPriorityLevelLabel(ranking.priorityLevel, effectiveMode)}
        </DossierStampTag>
      </div>

      <h2 className="dossier-technology-card__title">
        <Link href={`/technologies/${technology.slug}`}>
          <UnbreakableTitle text={title} />
        </Link>
      </h2>
      <p className="dossier-technology-card__summary">{summary}</p>

      {whyItMatters ? (
        <DossierCatalogNote label="为什么重要">
          {whyItMatters}
        </DossierCatalogNote>
      ) : null}

      <div className="dossier-technology-card__footer">
        <span className="dossier-technology-card__source">
          {technology.sourceName}
        </span>
        {contextChips.length > 0 ? (
          <div className="dossier-technology-card__chips">
            {contextChips.map((item) => (
              <DossierStampTag key={item} className="dossier-stamp-tag--muted">
                {item}
              </DossierStampTag>
            ))}
          </div>
        ) : null}
        <Link
          href={`/technologies/${technology.slug}`}
          className="dossier-technology-card__open"
        >
          查看信号 →
        </Link>
      </div>

      {readingActions}
    </DossierCard>
  );
}
