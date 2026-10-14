"use client";

import { useState } from "react";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { LangScope } from "@/components/lang-scope";
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
import { commonCopy } from "@/lib/i18n/copy/common";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { localePath } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatWeekRangeFromKey } from "@/lib/week-range";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { estimateReadingMinutes, formatReadingTime } from "@/lib/reading-time";
import { getSourceDirectoryHref } from "@/lib/source-directory";
// Type-only: the module reads the digest store, which a client component
// must not bundle. The data arrives as a prop from the server page.
import type { SignalIssueAppearances } from "@/lib/signal-digest-appearances";
// Type-only for the same reason: the module reads the published pool.
import type { SignalNeighbors } from "@/lib/signal-neighbors";
import type { SimilarSignalLink } from "@/lib/similar-signals";
import type { KnowledgeLinkTarget } from "@/lib/knowledge-autolink";
import type { TechnologyEvolutionChain } from "@/lib/technology-evolution";
import {
  getPriorityLevelLabel,
  getPriorityUserSummary
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getPublisherTypeLabel,
  getRelationTypeLabel,
  getTechnologyBodyForLocale,
  getTechnologyDefaultMode,
  getTechnologyTextForMode,
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
  evolutionChain?: TechnologyEvolutionChain;
  /** Omitted by the workspace preview: drafts are not in the embedded pool. */
  similarSignals?: (SimilarSignalLink & {
    titleLang?: string;
    summaryLang?: string;
  })[];
  /** Omitted by the workspace preview: a draft is in no published issue. */
  issueAppearances?: SignalIssueAppearances;
  /** Omitted by the workspace preview: a draft has no place in the list. */
  neighbors?: SignalNeighbors;
  /** Knowledge the body mentions; each links at its first mention. */
  knowledgeLinks?: KnowledgeLinkTarget[];
  /**
   * English site only: `lang` per signal slug for the titles the server put
   * in the interface language where it could (release line, pager).
   */
  titleLangs?: Record<string, string>;
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
  neighbors,
  knowledgeLinks,
  titleLangs = {}
}: TechnologyDetailContentProps) {
  const locale = useLocale();
  const pageCopy = technologyDetailCopy[locale];
  const sectionCopy = pageCopy.sections;
  // Every editor-written field (why it matters, context, audience, learning
  // path, questions, relation notes) exists in Chinese only.
  const zhLang = contentLangAttr(locale);
  const hasDetailChinese = hasTechnologyChineseContentForContext(
    technology,
    "detail"
  );
  // The English site opens on the original text, the Chinese site on 中文
  // when there is one.
  const [requestedMode, setRequestedMode] = useState<TechnologyContentMode>(
    locale === "en"
      ? "original"
      : getTechnologyDefaultMode(technology, "detail")
  );
  const mode = getEffectiveTechnologyMode(technology, requestedMode, "detail");
  const copy = getTechnologyDetailCopy(locale === "en" ? "original" : mode);
  const ranking = evaluateTechnologyPriority(technology);
  // The workspace preview renders drafts through this component: a draft has
  // no public address to copy, so it gets neither 复制链接 nor the 「#」s.
  const sharePath =
    technology.status === "published"
      ? localePath(locale, `/technologies/${technology.slug}`)
      : undefined;
  // The same rule for the publisher's /sources card: a draft's publisher may
  // have no published signal, and so no card to land on.
  const publisherHref =
    technology.status === "published" && technology.publisherName?.trim()
      ? getSourceDirectoryHref(technology.publisherName, locale)
      : undefined;

  const titleText = getTechnologyTextForMode(
    technology.title,
    mode,
    technology.sourceLanguage,
    locale
  );
  const summaryText = getTechnologyTextForMode(
    technology.summary,
    mode,
    technology.sourceLanguage,
    locale
  );
  const title = titleText.text;
  const summary = summaryText.text;
  const priorityLabel = getPriorityLevelLabel(
    ranking.priorityLevel,
    mode,
    locale
  );
  const publisherTypeLabel = getPublisherTypeLabel(
    technology.publisherType,
    mode,
    locale
  );
  const prioritySummary = getPriorityUserSummary(
    ranking,
    mode,
    technology.importanceLevel,
    locale
  );
  const bodyText = getTechnologyBodyForLocale(technology, mode, locale);
  const body = bodyText.text;
  // One line, where the reading column starts, for whatever on the page is
  // Chinese only.
  const chineseNote =
    locale !== "en"
      ? ""
      : technology.sourceLanguage === "zh"
        ? sectionCopy.chineseNote.chineseSource
        : bodyText.isChineseWriteUp
          ? sectionCopy.chineseNote.writeUp
          : sectionCopy.chineseNote.notesOnly;
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
  const readingMinutes = estimateReadingMinutes(body, [
    summary,
    whyItMatters ?? "",
    technicalContext ?? "",
    ...learningPath,
    ...followUpQuestions
  ]);
  const readingTimeLabel =
    locale === "zh"
      ? formatReadingTime(readingMinutes, mode)
      : commonCopy[locale].readingTime(readingMinutes);
  const readingDifficultyLabel = getReadingDifficultyLabel(
    technology.readingDifficulty,
    locale
  );
  // The seed notes written in English stay English on the English site;
  // every other note is Chinese. On the Chinese site nothing changes.
  const noteMode: TechnologyContentMode = locale === "en" ? "original" : mode;
  const noteLangOf = (note: string) =>
    locale === "en" ? nameLangAttr(locale, note) : undefined;
  const relationLabel = (relationType: RelationListItem["relationType"]) =>
    getRelationTypeLabel(relationType, mode, locale);
  const localizedRelatedSkills = relatedSkills.map((item) => {
    const note = getTechnologyRelationNote(
      getTechnologySkillExplanation(technology, item.targetId ?? "", item.note),
      noteMode
    );

    return { ...item, note, noteLang: noteLangOf(note) };
  });
  const localizedRelatedKnowledge = relatedKnowledge.map((item) => {
    const note = getTechnologyRelationNote(
      getTechnologyKnowledgeExplanation(
        technology,
        item.targetId ?? "",
        item.note
      ),
      noteMode
    );

    return { ...item, note, noteLang: noteLangOf(note) };
  });
  const localizedRelatedTechnologies = relatedTechnologies.map((item) => ({
    ...item,
    noteLang: item.noteLang ?? noteLangOf(item.note)
  }));
  const graphNodes: RelationshipGraphNode[] = [
    ...localizedRelatedTechnologies.map((item) => ({
      title: item.title,
      href: item.href,
      kind: "technology" as const,
      relationLabel: relationLabel(item.relationType),
      note: item.note,
      lang: item.titleLang
    })),
    ...localizedRelatedSkills.map((item) => ({
      title: item.title,
      href: item.href,
      kind: "skill" as const,
      relationLabel: relationLabel(item.relationType),
      note: item.note,
      lang: item.titleLang
    })),
    ...localizedRelatedKnowledge.map((item) => ({
      title: item.title,
      href: item.href,
      kind: "knowledge" as const,
      relationLabel: relationLabel(item.relationType),
      note: item.note,
      lang: item.titleLang
    }))
  ];
  // Same conditions the sections below render on, so the table lists exactly
  // what is on the page.
  const tocEntries = selectPageTocEntries(
    getTechnologyTocCandidates({
      locale,
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
                {pageCopy.hero.catalog(
                  getTechnologyTypeLabel(technology.type, mode, locale),
                  technology.publishDate
                )}
              </span>
              <TechnologyLanguageSwitch
                mode={mode}
                onChange={setRequestedMode}
                chineseEnabled={hasDetailChinese}
              />
            </div>

            <h1 lang={contentLangAttr(locale, titleText.language)}>
              <UnbreakableTitle text={title} />
            </h1>
            <p
              className="user-article-hero__summary"
              lang={contentLangAttr(locale, summaryText.language)}
            >
              {summary}
            </p>

            <div className="technology-detail-hero__meta">
              <span lang={nameLangAttr(locale, technology.sourceName)}>
                {technology.sourceName}
              </span>
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
            locale={locale}
          />

          {/* The hero already prints this label and sentence. */}
          <section className="user-reference-panel" data-print="hide">
            <p className="eyebrow user-eyebrow">{pageCopy.aside.priority}</p>
            <h2>{priorityLabel}</h2>
            <p className="user-reference-panel__copy">{prioritySummary}</p>
          </section>

          {readingDifficultyLabel ? (
            <section className="user-reference-panel">
              <p className="eyebrow user-eyebrow">
                {pageCopy.aside.difficulty}
              </p>
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

      <ChineseOnlyNote locale={locale}>{chineseNote}</ChineseOnlyNote>

      {evolutionChain ? (
        <TechnologyEvolutionLine
          chain={evolutionChain}
          id={tocIds.evolution}
          sharePath={sharePath}
          titleLangs={titleLangs}
          noteLang={zhLang}
          locale={locale}
        />
      ) : null}

      {body ? (
        <section
          id={tocIds.body}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.bodyEyebrow}
          </p>
          <SectionHeading sectionId={tocIds.body} sharePath={sharePath}>
            {sectionCopy.bodyHeading}
          </SectionHeading>
          <LangScope lang={contentLangAttr(locale, bodyText.language)}>
            <ContentBody body={body} knowledgeLinks={knowledgeLinks} />
          </LangScope>
        </section>
      ) : null}

      {whyItMatters ? (
        <section
          id={tocIds.whyItMatters}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.whyEyebrow}
          </p>
          <SectionHeading sectionId={tocIds.whyItMatters} sharePath={sharePath}>
            {sectionCopy.whyHeading}
          </SectionHeading>
          <p
            className="technology-detail-section__lede"
            lang={technology.whyItMatters?.trim() ? zhLang : undefined}
          >
            {whyItMatters}
          </p>
        </section>
      ) : null}

      {technicalContext ? (
        <section
          id={tocIds.technicalContext}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.contextEyebrow}
          </p>
          <SectionHeading
            sectionId={tocIds.technicalContext}
            sharePath={sharePath}
          >
            {sectionCopy.contextHeading}
          </SectionHeading>
          <p className="technology-detail-section__lede" lang={zhLang}>
            {technicalContext}
          </p>
        </section>
      ) : null}

      <TechnologyExplainWidget technology={technology} />

      {audienceItems.length > 0 || impactAreas.length > 0 ? (
        <section
          id={tocIds.audience}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.audienceEyebrow}
          </p>
          <SectionHeading sectionId={tocIds.audience} sharePath={sharePath}>
            {sectionCopy.audienceHeading}
          </SectionHeading>
          {audienceItems.length > 0 ? (
            <div className="technology-detail-chip-row">
              {audienceItems.map((item) => (
                <DossierStampTag
                  key={item}
                  className="dossier-stamp-tag--muted"
                  lang={zhLang}
                >
                  {item}
                </DossierStampTag>
              ))}
            </div>
          ) : null}
          {impactAreas.length > 0 ? (
            <div className="technology-detail-impact">
              <span>{sectionCopy.impactAreas}</span>
              <div className="technology-detail-chip-row">
                {impactAreas.map((item) => (
                  <DossierStampTag
                    key={item}
                    className="dossier-stamp-tag--muted"
                    lang={zhLang}
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
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.learningEyebrow}
          </p>
          <SectionHeading sectionId={tocIds.learningPath} sharePath={sharePath}>
            {sectionCopy.learningHeading}
          </SectionHeading>
          <ol className="technology-detail-learning-list" lang={zhLang}>
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
        centerLang={contentLangAttr(locale, titleText.language)}
        nodes={graphNodes}
        heading={sectionCopy.graphHeading}
        hint={sectionCopy.graphHint}
        locale={locale}
      />

      <DossierRelatedItemsSection
        id={tocIds.relatedTechnologies}
        sharePath={sharePath}
        title={sectionCopy.relatedTechnologies}
        description={sectionCopy.relatedTechnologiesDescription}
        items={localizedRelatedTechnologies}
        linkLabel={sectionCopy.viewTechnology}
        formatRelationType={relationLabel}
        locale={locale}
      />

      <DossierRelatedItemsSection
        id={tocIds.similarSignals}
        sharePath={sharePath}
        title={sectionCopy.similarHeading}
        description={sectionCopy.similarDescription}
        items={similarSignals.map((item) => ({
          id: item.id,
          title: item.title,
          href: item.href,
          relationType: "related-to" as const,
          note: item.summary ?? "",
          titleLang: item.titleLang,
          noteLang: item.summaryLang
        }))}
        linkLabel={sectionCopy.viewSignal}
        formatRelationType={() => sectionCopy.autoMatched}
        locale={locale}
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
        linkLabel={sectionCopy.viewSkill}
        formatRelationType={relationLabel}
        locale={locale}
      />

      <DossierRelatedItemsSection
        id={tocIds.relatedKnowledge}
        sharePath={sharePath}
        title={copy.relatedKnowledgeTitle}
        description={copy.relatedKnowledgeDescription}
        items={localizedRelatedKnowledge}
        linkLabel={sectionCopy.viewConcept}
        formatRelationType={relationLabel}
        locale={locale}
      />

      {followUpQuestions.length > 0 ? (
        <section
          id={tocIds.followUpQuestions}
          className="user-article-section technology-detail-section"
        >
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.followUpEyebrow}
          </p>
          <SectionHeading
            sectionId={tocIds.followUpQuestions}
            sharePath={sharePath}
          >
            {sectionCopy.followUpHeading}
          </SectionHeading>
          <ul className="technology-detail-question-list" lang={zhLang}>
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
          <p className="technology-detail-section__eyebrow">
            {sectionCopy.appearancesEyebrow}
          </p>
          <SectionHeading
            sectionId={tocIds.digestAppearances}
            sharePath={sharePath}
          >
            {sectionCopy.appearancesHeading}
          </SectionHeading>
          <p className="signal-issue-appearances__note">
            {sectionCopy.appearancesNote(Boolean(issueAppearances.weekly))}
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
                  href={localePath(locale, digest.href)}
                  tag={sectionCopy.issueSections[digest.section]}
                  headingLevel={3}
                  titleLang={nameLangAttr(locale, digest.title)}
                />
              </li>
            ))}
            {issueAppearances.weekly ? (
              <li>
                <DossierRegisterRow
                  title={sectionCopy.weeklyRow(
                    locale === "zh"
                      ? issueAppearances.weekly.rangeLabel
                      : formatWeekRangeFromKey(
                          issueAppearances.weekly.weekKey,
                          locale
                        )
                  )}
                  href={localePath(locale, issueAppearances.weekly.href)}
                  tag={
                    sectionCopy.issueSections[issueAppearances.weekly.section]
                  }
                  headingLevel={3}
                />
              </li>
            ) : null}
          </ol>
        </section>
      ) : null}

      <SourceReference
        title={sectionCopy.sourceFoot}
        sourceName={technology.sourceName}
        sourceUrl={technology.sourceUrl}
        publisherName={technology.publisherName}
        publisherHref={publisherHref}
        publisherTypeLabel={publisherTypeLabel}
        publishDate={technology.publishDate}
        linkLabel={copy.sourceLinkLabel}
        showUrl
        locale={locale}
      />

      {/* Last, as on the digest page: the article ends with its source, and
          the pager leads away from it. Publish order, as in the 精选 list —
          not the 版本脉络 line. ← is the older signal, as ← 上一期 is the
          older issue on the digest and weekly pages. */}
      {neighbors ? (
        <IssuePager
          unit="条"
          ariaLabel={sectionCopy.pagerLabel}
          locale={locale}
          previous={
            neighbors.older
              ? {
                  href: localePath(
                    locale,
                    `/technologies/${neighbors.older.slug}`
                  ),
                  label: neighbors.older.title
                }
              : undefined
          }
          previousLang={
            neighbors.older ? titleLangs[neighbors.older.slug] : undefined
          }
          next={
            neighbors.newer
              ? {
                  href: localePath(
                    locale,
                    `/technologies/${neighbors.newer.slug}`
                  ),
                  label: neighbors.newer.title
                }
              : undefined
          }
          nextLang={
            neighbors.newer ? titleLangs[neighbors.newer.slug] : undefined
          }
        />
      ) : null}
    </UserArticleLayout>
  );
}
