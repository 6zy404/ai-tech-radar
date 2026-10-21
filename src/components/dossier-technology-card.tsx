import Link from "next/link";
import type { ReactNode } from "react";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { LangSpan } from "@/components/lang-scope";
import { SignalAudienceLine } from "@/components/signal-audience-line";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { NewStamp } from "@/components/visit-baseline";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
  getTechnologyWhyItMatters
} from "@/lib/content-intelligence";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getTechnologyTextForMode,
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
  /**
   * Adds the 新 stamp: the signal is new since the reader's last visit
   * (`src/lib/visit-state.ts`). Never true on the server render.
   */
  isNew?: boolean;
  /**
   * Outlines the card the keyboard shortcuts are on (j / k). Surfaces
   * without shortcuts never pass it.
   */
  isCurrent?: boolean;
  /** The 稍后读 / 已读 toggles; omitted on surfaces without reading state. */
  readingActions?: ReactNode;
  /**
   * The P4 「命中关注：X」 line, rendered inside the card.
   *
   * The digest has put it inside its card since 2026-07-29, when leaving it
   * outside was recorded as a stray floating label; the 我关注的 view kept
   * rendering it above the card, so the same feature read two ways on two
   * surfaces (measured 2026-08-16: 4/4 inside on the digest, 45/45 outside
   * here). Passing it in keeps the card the only thing that decides where it
   * sits.
   */
  matchLine?: ReactNode;
  locale?: Locale;
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
  isNew = false,
  isCurrent = false,
  readingActions,
  matchLine,
  locale = "zh"
}: DossierTechnologyCardProps) {
  const copy = signalsCopy[locale].card;
  const effectiveMode = getEffectiveTechnologyMode(technology, mode, context);
  const titleText = getTechnologyTextForMode(
    technology.title,
    effectiveMode,
    technology.sourceLanguage,
    locale
  );
  const summaryText = getTechnologyTextForMode(
    technology.summary,
    effectiveMode,
    technology.sourceLanguage,
    locale
  );
  const title = titleText.text;
  const summary = summaryText.text;
  const href = localePath(locale, `/technologies/${technology.slug}`);
  const ranking = evaluateTechnologyPriority(technology);
  // The editors' note and audience lines are written in Chinese only.
  const whyItMattersLang = technology.whyItMatters?.trim()
    ? contentLangAttr(locale)
    : contentLangAttr(locale, summaryText.language);
  const whyItMatters =
    getTechnologyWhyItMatters(technology, summary) ?? summary;
  const difficultyLabel = getReadingDifficultyLabel(
    technology.readingDifficulty,
    locale
  );
  // The audience is a sentence, not a label: as 10.5px chips, 103 of 440
  // on /technologies wrapped onto a second line (2026-10-21). It is now the
  // digest card's 适合 … line; the chips keep the difficulty and topics.
  const contextChips = [
    ...(difficultyLabel ? [{ label: difficultyLabel, lang: undefined }] : []),
    ...tags.map((tag) => ({ label: tag.name, lang: undefined }))
  ]
    .filter((item) => Boolean(item.label))
    .slice(0, 4);

  return (
    <DossierCard
      className={`dossier-technology-card${
        isRead ? " dossier-technology-card--read" : ""
      }${isCurrent ? " dossier-technology-card--current" : ""}`}
    >
      {/* Pinned to the card's top edge, out of flow: it appears after mount,
          and in the topline it squeezed the catalog span onto a second line
          (measured 2026-09-30: +8px on a 1440 card), moving the grid. */}
      {isNew && !isRead ? <NewStamp /> : null}
      <div className="dossier-technology-card__topline">
        <span className="dossier-technology-card__catalog">
          {copy.catalog(
            getTechnologyTypeLabel(technology.type, effectiveMode, locale),
            technology.publishDate
          )}
        </span>
        {isRead ? (
          <DossierStampTag className="dossier-technology-card__read-stamp">
            {copy.read}
          </DossierStampTag>
        ) : null}
        <DossierStampTag>
          {getPriorityLevelLabel(ranking.priorityLevel, effectiveMode, locale)}
        </DossierStampTag>
      </div>

      {matchLine}

      <h2
        className="dossier-technology-card__title"
        lang={contentLangAttr(locale, titleText.language)}
      >
        {/* data-signal-id is what the list shortcuts focus (j / k). */}
        <Link href={href} data-signal-id={technology.id}>
          <UnbreakableTitle text={title} />
        </Link>
      </h2>
      <p
        className="dossier-technology-card__summary"
        lang={contentLangAttr(locale, summaryText.language)}
      >
        {summary}
      </p>

      {whyItMatters ? (
        <DossierCatalogNote label={copy.whyItMatters}>
          <LangSpan lang={whyItMattersLang}>{whyItMatters}</LangSpan>
        </DossierCatalogNote>
      ) : null}

      <SignalAudienceLine
        audience={getTechnologyAudience(technology)}
        locale={locale}
        className="dossier-technology-card__audience"
        limit={2}
      />

      <div className="dossier-technology-card__footer">
        <span
          className="dossier-technology-card__source"
          lang={nameLangAttr(locale, technology.sourceName)}
        >
          {technology.sourceName}
        </span>
        {contextChips.length > 0 ? (
          <div className="dossier-technology-card__chips">
            {contextChips.map((item) => (
              <DossierStampTag
                key={item.label}
                className="dossier-stamp-tag--muted"
                lang={item.lang}
              >
                {item.label}
              </DossierStampTag>
            ))}
          </div>
        ) : null}
        <Link href={href} className="dossier-technology-card__open">
          {copy.open}
        </Link>
      </div>

      {readingActions}
    </DossierCard>
  );
}
