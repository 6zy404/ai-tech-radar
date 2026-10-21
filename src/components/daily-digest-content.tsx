"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { ContentBody } from "@/components/content-body";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { IssuePager } from "@/components/issue-pager";
import { LangScope, LangSpan } from "@/components/lang-scope";
import { PageToc } from "@/components/page-toc";
import { ReadingProgress } from "@/components/reading-progress";
import { SectionHeading } from "@/components/section-link";
import { SignalAudienceLine } from "@/components/signal-audience-line";
import { TagList } from "@/components/tag-list";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { compactText } from "@/lib/compact-text";
import { getDigestTechnologyIntelligenceSummary } from "@/lib/content-intelligence";
import type {
  PublicDigestNeighbors,
  PublicDigestView
} from "@/lib/digest-view";
import { jsonFeedPath, rssFeedPath } from "@/lib/feed-paths";
import {
  followedTagsChangedEventName,
  readFollowedTagIds
} from "@/lib/followed-tags";
import { digestCopy } from "@/lib/i18n/copy/digest";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getDigestTocCandidates,
  getDigestTocSections,
  selectPageTocEntries
} from "@/lib/page-toc";
import { getReadingDifficultyLabel } from "@/lib/content-intelligence";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getTechnologyTextForMode,
  getTechnologyTypeLabel,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TechnologySourceReference,
  TopicTag
} from "@/types/content";

interface DailyDigestContentProps {
  digest: PublicDigestView;
  highPriorityTechnologies: TechnologyItem[];
  watchTechnologies: TechnologyItem[];
  skills: SkillItem[];
  knowledge: KnowledgeItem[];
  tags: TopicTag[];
  previewNotice?: string;
  showDeliveryLinks?: boolean;
  /** Published neighbours for the 上一期 / 下一期 pager; public pages only. */
  neighbors?: PublicDigestNeighbors;
}

interface DigestTechnologyCardProps {
  technology: TechnologyItem;
  tags: TopicTag[];
  compact?: boolean;
  /**
   * Names of the reader's followed topics this signal matched (P4). Rendered
   * inside the card; before 2026-07-29 it was a sibling paragraph above the
   * card, which read as a stray section label floating over the grid.
   */
  matchedTagNames?: string[];
  locale: Locale;
}

interface DigestSourceReference extends TechnologySourceReference {
  id: string;
}

function getTechnologyTags(
  technology: TechnologyItem,
  tags: TopicTag[]
): TopicTag[] {
  return technology.tags
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TopicTag => Boolean(tag));
}

function getDigestSourceReferences(
  digest: PublicDigestView,
  technologies: TechnologyItem[]
): DigestSourceReference[] {
  const references = new Map<string, DigestSourceReference>();

  for (const technology of technologies) {
    const technologyReferences =
      technology.sourceReferences && technology.sourceReferences.length > 0
        ? technology.sourceReferences
        : [
            {
              sourceName: technology.sourceName,
              sourceUrl: technology.sourceUrl,
              publisherName: technology.publisherName,
              publishDate: technology.publishDate
            }
          ];

    for (const reference of technologyReferences) {
      // Keyed by the organisation the card is about, not by the article URL.
      // Keyed by URL, two signals from the same publisher on the same day
      // produced two cards that were identical character for character.
      const key = reference.publisherName || reference.sourceName;
      const existing = references.get(key);

      if (
        existing &&
        (existing.publishDate ?? "") >= (reference.publishDate ?? "")
      ) {
        continue;
      }

      references.set(key, {
        id: key,
        ...reference
      });
    }
  }

  for (const sourceName of digest.sourceNames) {
    if (
      ![...references.values()].some((item) => item.sourceName === sourceName)
    ) {
      references.set(sourceName, {
        id: sourceName,
        sourceName,
        sourceUrl: ""
      });
    }
  }

  return [...references.values()];
}

function DigestTechnologyCard({
  technology,
  tags,
  compact = false,
  matchedTagNames = [],
  locale
}: DigestTechnologyCardProps) {
  const copy = digestCopy[locale].content;
  const mode: TechnologyContentMode = locale === "en" ? "original" : "zh";
  const effectiveMode = getEffectiveTechnologyMode(
    technology,
    mode,
    compact ? "preview" : "detail"
  );
  const ranking = evaluateTechnologyPriority(technology);
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
  const priorityReason = copy.priorityReasons[ranking.priorityLevel];
  const intelligence = getDigestTechnologyIntelligenceSummary(
    technology,
    ranking,
    priorityReason
  );
  // The editors' note is Chinese; the fallback reason is interface text.
  const whyItMattersLang = intelligence.whyItMatters
    ? contentLangAttr(locale)
    : undefined;
  const whyItMatters = compactText(
    intelligence.whyItMatters ?? priorityReason,
    compact ? 130 : 180,
    "..."
  );
  const difficulty = getReadingDifficultyLabel(
    technology.readingDifficulty,
    locale
  );
  const href = localePath(locale, `/technologies/${technology.slug}`);

  return (
    <DossierCard
      className={`digest-technology-card${
        compact ? " digest-technology-card--compact" : ""
      }${compact ? "" : " digest-technology-card--featured"}`}
    >
      <div className="digest-technology-card__topline">
        <div className="digest-technology-card__badges">
          <DossierStampTag className="dossier-stamp-tag--muted">
            {getTechnologyTypeLabel(technology.type, "zh", locale)}
          </DossierStampTag>
          <DossierStampTag>
            {getPriorityLevelLabel(ranking.priorityLevel, "zh", locale)}
          </DossierStampTag>
        </div>
      </div>

      <div className="digest-technology-card__body">
        {matchedTagNames.length > 0 ? (
          <p className="my-radar__match-line digest-technology-card__match">
            {copy.matchLine(matchedTagNames.join(copy.matchJoin))}
          </p>
        ) : null}
        <h3 lang={contentLangAttr(locale, titleText.language)}>
          <Link href={href}>{title}</Link>
        </h3>
        <p
          className="digest-technology-card__summary"
          lang={contentLangAttr(locale, summaryText.language)}
        >
          {compactText(summary, compact ? 140 : 190, "...")}
        </p>
        <DossierCatalogNote label={copy.whyItMatters}>
          <LangSpan lang={whyItMattersLang}>{whyItMatters}</LangSpan>
        </DossierCatalogNote>
        <SignalAudienceLine
          audience={intelligence.audience}
          locale={locale}
          className="digest-technology-card__audience"
        />
      </div>

      <div className="digest-technology-card__footer">
        <div className="digest-technology-card__meta-line">
          <span lang={nameLangAttr(locale, technology.sourceName)}>
            {technology.sourceName}
          </span>
          <span>{technology.publishDate}</span>
          {difficulty ? <span>{difficulty}</span> : null}
          {!compact ? (
            <span>
              {copy.relatedCounts(
                intelligence.relatedSkillCount,
                intelligence.relatedKnowledgeCount
              )}
            </span>
          ) : null}
        </div>
        <div className="digest-technology-card__actions">
          <TagList
            tags={getTechnologyTags(technology, tags)}
            limit={compact ? 2 : 4}
          />
          <Link
            className="action-link digest-technology-card__open"
            href={href}
          >
            {copy.openSignal}
          </Link>
        </div>
      </div>
    </DossierCard>
  );
}

function DigestReferenceList<
  T extends { id: string; title: string; slug: string; summary: string }
>({
  id,
  title,
  description,
  emptyText,
  items,
  hrefPrefix,
  linkLabel,
  sharePath,
  itemLang
}: {
  id: string;
  title: string;
  description: string;
  emptyText: string;
  items: T[];
  hrefPrefix: string;
  linkLabel: string;
  sharePath?: string;
  /** `lang` of every item's title and summary (skills and knowledge). */
  itemLang?: string;
}) {
  return (
    <section id={id} className="digest-reference-section">
      <div className="daily-digest-section__header">
        <SectionHeading sectionId={id} sharePath={sharePath}>
          {title}
        </SectionHeading>
        <p>{description}</p>
      </div>
      {items.length > 0 ? (
        <div className="digest-reference-list">
          {items.map((item) => (
            <DossierCard key={item.id} className="digest-reference-item">
              <div>
                <h3 lang={itemLang}>
                  <Link href={`${hrefPrefix}/${item.slug}`}>{item.title}</Link>
                </h3>
                <p lang={itemLang}>{item.summary}</p>
              </div>
              <Link
                className="action-link digest-reference-item__link"
                href={`${hrefPrefix}/${item.slug}`}
              >
                {linkLabel}
              </Link>
            </DossierCard>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  );
}

function DigestSourceReferences({
  references,
  sharePath,
  locale
}: {
  references: DigestSourceReference[];
  sharePath?: string;
  locale: Locale;
}) {
  const copy = digestCopy[locale].content;
  const sections = getDigestTocSections(locale);

  return (
    <section
      id={sections.sources.id}
      className="daily-digest-section daily-digest-sources"
    >
      <div className="daily-digest-section__header daily-digest-section__header--compact">
        <SectionHeading sectionId={sections.sources.id} sharePath={sharePath}>
          {sections.sources.label}
        </SectionHeading>
        <p>{copy.sourcesDescription}</p>
      </div>
      {references.length > 0 ? (
        <div className="digest-source-list">
          {references.map((reference) => (
            <DossierCard key={reference.id} className="digest-source-chip">
              {/* The publisher leads: the feed name repeated across four cards
                  while the organisation that distinguished them sat in the
                  subtitle. */}
              <h3
                lang={nameLangAttr(
                  locale,
                  reference.publisherName || reference.sourceName
                )}
              >
                {reference.publisherName || reference.sourceName}
              </h3>
              <p
                lang={
                  reference.publisherName
                    ? nameLangAttr(locale, reference.sourceName)
                    : undefined
                }
              >
                {[
                  reference.publisherName ? reference.sourceName : undefined,
                  reference.publishDate
                ]
                  .filter(Boolean)
                  .join(" - ") || copy.publicSource}
              </p>
              {reference.sourceUrl ? (
                <a
                  className="action-link"
                  href={reference.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {copy.openSource}
                </a>
              ) : null}
            </DossierCard>
          ))}
        </div>
      ) : (
        <p className="empty-state">{copy.noSources}</p>
      )}
    </section>
  );
}

export function DailyDigestContent({
  digest,
  highPriorityTechnologies,
  watchTechnologies,
  skills,
  knowledge,
  tags,
  previewNotice,
  showDeliveryLinks = false,
  neighbors
}: DailyDigestContentProps) {
  const locale = useLocale();
  const copy = digestCopy[locale].content;
  const sections = getDigestTocSections(locale);
  // The digest's own text (title, editors' summary) is Chinese only.
  const zhLang = contentLangAttr(locale);
  const publicTitle = digest.title;
  const publicSummary = digest.summary;
  const selectedTechnologies = [
    ...highPriorityTechnologies,
    ...watchTechnologies
  ];
  const sourceReferences = getDigestSourceReferences(
    digest,
    selectedTechnologies
  );
  const sourceCount = sourceReferences.length;
  // The issue's own dated address, also from /digest/today, which shows a
  // different issue tomorrow. The workspace preview (no delivery links) gets
  // neither 复制链接 nor the 「#」s: a draft has no public address.
  const sharePath = showDeliveryLinks
    ? localePath(locale, `/digest/${digest.date}`)
    : undefined;

  // Personalized digest view (P4): highlight and optionally filter by the
  // reader's followed topics. Follows stay in browser localStorage only —
  // the served digest content is identical for everyone.
  const [followedTagIds, setFollowedTagIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showOnlyFollowed, setShowOnlyFollowed] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => setFollowedTagIds(readFollowedTagIds());

    syncFromStorage();
    setIsLoaded(true);
    window.addEventListener(followedTagsChangedEventName, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(followedTagsChangedEventName, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const followedTagSet = new Set(followedTagIds);
  const getMatchedTags = (technology: TechnologyItem): TopicTag[] =>
    tags.filter(
      (tag) => followedTagSet.has(tag.id) && technology.tags.includes(tag.id)
    );

  const hasFollows = isLoaded && followedTagIds.length > 0;
  const filterActive = hasFollows && showOnlyFollowed;
  const matchedCount = hasFollows
    ? selectedTechnologies.filter(
        (technology) => getMatchedTags(technology).length > 0
      ).length
    : 0;
  const visibleHighPriorityTechnologies = filterActive
    ? highPriorityTechnologies.filter(
        (technology) => getMatchedTags(technology).length > 0
      )
    : highPriorityTechnologies;
  const visibleWatchTechnologies = filterActive
    ? watchTechnologies.filter(
        (technology) => getMatchedTags(technology).length > 0
      )
    : watchTechnologies;
  const filterHasNoMatches =
    filterActive &&
    visibleHighPriorityTechnologies.length === 0 &&
    visibleWatchTechnologies.length === 0;

  // Built from the counts the sections below render on, after the filter,
  // so an entry never points at a section the filter has removed.
  const tocEntries = selectPageTocEntries(
    getDigestTocCandidates({
      locale,
      hasSummary: Boolean(publicSummary),
      visibleHighPriorityCount: visibleHighPriorityTechnologies.length,
      visibleWatchCount: visibleWatchTechnologies.length,
      skillCount: skills.length,
      knowledgeCount: knowledge.length,
      sourceCount
    })
  );

  return (
    <div className="daily-digest daily-digest-reading dossier">
      {/* Same hero primitive as /technologies/[slug] (user-article-hero), so
          the two public detail pages read as one family. Before 2026-07-29
          this page hand-rolled a two-column header whose narrow right column
          held only the four counts. */}
      <section className="user-article-hero daily-digest-brief-header">
        <div className="user-article-hero__copy daily-digest-brief-header__copy">
          <p className="eyebrow user-eyebrow">{copy.eyebrow(digest.date)}</p>
          <h1 lang={nameLangAttr(locale, publicTitle)}>
            <UnbreakableTitle text={publicTitle} />
          </h1>
          <div className="daily-digest-meta-strip" aria-label={copy.metaLabel}>
            <span>{copy.metaHigh(highPriorityTechnologies.length)}</span>
            <span>{copy.metaWatch(watchTechnologies.length)}</span>
            <span>{copy.metaSources(sourceCount)}</span>
            {sharePath ? <CopyLinkButton sharePath={sharePath} /> : null}
          </div>
          {previewNotice ? (
            <p className="daily-digest-brief-header__notice">{previewNotice}</p>
          ) : null}
        </div>
      </section>

      {/* The page is one column with no aside, so the table is the folded
          variant at every width, above the first section it lists. */}
      <PageToc entries={tocEntries} variant="disclosure" />

      <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>

      {publicSummary ? (
        <section
          id={sections.summary.id}
          className="daily-digest-summary-panel"
        >
          {/* An h2 styled as the eyebrow it was: the section needs a heading
              for the table to move focus to, and the outline gains one. */}
          <SectionHeading
            sectionId={sections.summary.id}
            sharePath={sharePath}
            className="eyebrow user-eyebrow"
          >
            {sections.summary.label}
          </SectionHeading>
          {/* Rendered through ContentBody like every other long-form body on
              the site. It was a bare <p> until 2026-08-09, so an editorial
              summary written with the same Markdown subset used everywhere
              else shipped its `**` markers to readers verbatim — hit for real
              on the 08-07 digest. */}
          <LangScope lang={nameLangAttr(locale, publicSummary)}>
            <ContentBody body={publicSummary} />
          </LangScope>
        </section>
      ) : null}

      {isLoaded ? (
        hasFollows ? (
          <section
            className="daily-digest-personal-bar"
            aria-label={copy.personalLabel}
          >
            <p>{copy.followedSummary(followedTagIds.length, matchedCount)}</p>
            <button
              type="button"
              className={`my-radar__tag-toggle${
                filterActive ? " my-radar__tag-toggle--active" : ""
              }`}
              aria-pressed={filterActive}
              onClick={() => setShowOnlyFollowed((value) => !value)}
            >
              {filterActive ? <span aria-hidden="true">✓ </span> : null}
              {copy.onlyFollowed}
            </button>
          </section>
        ) : (
          <section className="daily-digest-personal-bar">
            <p>
              {copy.noFollowsBefore}
              <Link
                className="action-link"
                href={localePath(locale, "/technologies?view=followed")}
              >
                {copy.toMyRadar}
              </Link>
            </p>
          </section>
        )
      ) : null}

      {filterActive && visibleHighPriorityTechnologies.length === 0 ? null : (
        <section id={sections.highPriority.id} className="daily-digest-section">
          <div className="daily-digest-section__header">
            <SectionHeading
              sectionId={sections.highPriority.id}
              sharePath={sharePath}
            >
              {sections.highPriority.label}
            </SectionHeading>
            <p>{copy.highDescription}</p>
          </div>
          {visibleHighPriorityTechnologies.length > 0 ? (
            <div className="digest-technology-list digest-technology-list--featured">
              {visibleHighPriorityTechnologies.map((technology) => (
                <DigestTechnologyCard
                  key={technology.id}
                  technology={technology}
                  tags={tags}
                  matchedTagNames={getMatchedTags(technology).map(
                    (tag) => tag.name
                  )}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">{copy.noHigh}</p>
          )}
        </section>
      )}

      {filterActive && visibleWatchTechnologies.length === 0 ? null : (
        <section id={sections.watch.id} className="daily-digest-section">
          <div className="daily-digest-section__header daily-digest-section__header--secondary">
            <SectionHeading sectionId={sections.watch.id} sharePath={sharePath}>
              {sections.watch.label}
            </SectionHeading>
            <p>{copy.watchDescription}</p>
          </div>
          {/* Same two-column grid as 本期立即关注 above. Until 2026-07-29 this
              list was single-column, so identical cards rendered at two
              different widths on one page. */}
          {visibleWatchTechnologies.length > 0 ? (
            <div className="digest-technology-list digest-technology-list--featured">
              {visibleWatchTechnologies.map((technology) => (
                <DigestTechnologyCard
                  key={technology.id}
                  technology={technology}
                  tags={tags}
                  compact
                  matchedTagNames={getMatchedTags(technology).map(
                    (tag) => tag.name
                  )}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">{copy.noWatch}</p>
          )}
        </section>
      )}

      {filterHasNoMatches ? (
        <section className="empty-state empty-state--actionable">
          <strong>{copy.noMatchTitle}</strong>
          <p>
            {copy.noMatchBefore}
            <Link
              className="action-link"
              href={localePath(locale, "/technologies?view=followed")}
            >
              {copy.noMatchLink}
            </Link>
            {copy.noMatchAfter}
          </p>
          <button
            type="button"
            className="my-radar__tag-toggle"
            onClick={() => setShowOnlyFollowed(false)}
          >
            {copy.showAll}
          </button>
        </section>
      ) : null}

      <DigestReferenceList
        id={sections.skills.id}
        title={sections.skills.label}
        description={copy.skillsDescription}
        emptyText={copy.noSkills}
        items={skills}
        hrefPrefix={localePath(locale, "/skills")}
        linkLabel={copy.openSkill}
        sharePath={sharePath}
        itemLang={zhLang}
      />

      <DigestReferenceList
        id={sections.knowledge.id}
        title={sections.knowledge.label}
        description={copy.knowledgeDescription}
        emptyText={copy.noKnowledge}
        items={knowledge}
        hrefPrefix={localePath(locale, "/knowledge")}
        linkLabel={copy.openConcept}
        sharePath={sharePath}
        itemLang={zhLang}
      />

      <DigestSourceReferences
        references={sourceReferences}
        sharePath={sharePath}
        locale={locale}
      />

      {neighbors ? (
        <IssuePager
          unit="期"
          ariaLabel={copy.pagerLabel}
          locale={locale}
          previous={
            neighbors.previousDate
              ? {
                  href: localePath(locale, `/digest/${neighbors.previousDate}`),
                  label: neighbors.previousDate
                }
              : undefined
          }
          next={
            neighbors.nextDate
              ? {
                  href: localePath(locale, `/digest/${neighbors.nextDate}`),
                  label: neighbors.nextDate
                }
              : undefined
          }
        />
      ) : null}

      {showDeliveryLinks ? (
        <section className="daily-digest-section daily-digest-feeds">
          <div className="daily-digest-section__header daily-digest-section__header--compact">
            <h2>{copy.feedsHeading}</h2>
            <p>{copy.feedsBody}</p>
          </div>
          <div className="digest-feed-links">
            <Link href={rssFeedPath}>{copy.rss}</Link>
            <Link href={jsonFeedPath}>{copy.json}</Link>
            <Link href={localePath(locale, "/digest/weekly")}>
              {copy.weekly}
            </Link>
            <Link href={localePath(locale, "/digest")}>{copy.archive}</Link>
          </div>
        </section>
      ) : null}
      <ReadingProgress regionSelector=".daily-digest" />
    </div>
  );
}
