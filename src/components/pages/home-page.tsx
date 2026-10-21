import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { HomeRecommendSection } from "@/components/home-recommend-section";
import { HomeSignalCard } from "@/components/home-signal-card";
import { JsonLd } from "@/components/json-ld";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { UserPageShell } from "@/components/user-page-shell";
import {
  NewSignalStamp,
  VisitBaselineProvider
} from "@/components/visit-baseline";
import { contentLabelsByLocale } from "@/lib/content-labels";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
  getTechnologyWhyItMatters
} from "@/lib/content-intelligence";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies
} from "@/lib/content";
import { compactText } from "@/lib/compact-text";
import { getLatestPublishedDailyDigest } from "@/lib/digest-workflow";
import { digestCardSummaryLength } from "@/lib/digest-card-summary";
import { getDailyDigestRenderData } from "@/lib/digest-view";
import { homeCopy } from "@/lib/i18n/copy/home";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { localizeTags } from "@/lib/i18n/topic-names";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";
import { getLatestPublicNewsItems } from "@/lib/news";
import { buildWebSiteJsonLd } from "@/lib/structured-data";
import { toVisitKeys } from "@/lib/visit-state";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelLabel,
  getPriorityUserSummary
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getTechnologyTextForMode,
  type TechnologyTextForLocale
} from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";
import { buildPageMetadata } from "@/lib/site-metadata";

export function getHomePageMetadata(locale: Locale) {
  return buildPageMetadata({ path: "/", locale });
}

// The Chinese site shows a card's Chinese text when it has one; the English
// site its English text when the source is English.
function getHomeTechnologyText(
  technology: TechnologyItem,
  field: "title" | "summary",
  locale: Locale
): TechnologyTextForLocale {
  const mode = getEffectiveTechnologyMode(
    technology,
    locale === "en" ? "original" : "zh",
    "preview"
  );

  return getTechnologyTextForMode(
    technology[field],
    mode,
    technology.sourceLanguage,
    locale
  );
}

function HomeTechnologyCard({
  technology,
  tags,
  locale
}: {
  technology: TechnologyItem;
  tags: TopicTag[];
  locale: Locale;
}) {
  const ranking = evaluateTechnologyPriority(technology);
  const title = getHomeTechnologyText(technology, "title", locale);
  const summary = getHomeTechnologyText(technology, "summary", locale);
  // The editors' note is Chinese; the fallback band sentence is interface
  // text.
  const noteLang = technology.whyItMatters?.trim()
    ? contentLangAttr(locale)
    : undefined;
  const whyItMatters =
    getTechnologyWhyItMatters(
      technology,
      getPriorityUserSummary(ranking, "zh", technology.importanceLevel, locale)
    ) ?? summary.text;
  const audience = getTechnologyAudience(technology).slice(0, 3);
  const difficulty = getReadingDifficultyLabel(
    technology.readingDifficulty,
    locale
  );
  const cardTags = technology.tags
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TopicTag => Boolean(tag));

  return (
    <HomeSignalCard
      href={localePath(locale, `/technologies/${technology.slug}`)}
      title={title.text}
      titleLang={contentLangAttr(locale, title.language)}
      summary={summary.text}
      summaryLang={contentLangAttr(locale, summary.language)}
      priorityLabel={getPriorityLevelLabel(ranking.priorityLevel, "zh", locale)}
      publishDate={technology.publishDate}
      noteLabel={homeCopy[locale].priority.whyItMatters}
      note={whyItMatters}
      noteLang={noteLang}
      locale={locale}
      audience={audience}
      difficulty={difficulty || undefined}
      tags={cardTags}
      stamp={<NewSignalStamp technologyId={technology.id} />}
    />
  );
}

function SkillPathCard({
  skill,
  locale
}: {
  skill: SkillItem;
  locale: Locale;
}) {
  const entryLang = contentLangAttr(locale);
  const relatedTechnologies = getAllTechnologies().filter((technology) =>
    skill.relatedTechnologyIds.includes(technology.id)
  );

  return (
    <DossierCard className="foundation-card">
      <DossierStampTag className="dossier-stamp-tag--muted">
        {contentLabelsByLocale[locale].skillType[skill.skillType]}
      </DossierStampTag>
      <h3 lang={entryLang}>
        <Link href={localePath(locale, `/skills/${skill.slug}`)}>
          {skill.title}
        </Link>
      </h3>
      <p lang={entryLang}>{skill.summary}</p>
      <small>
        {homeCopy[locale].skills.linked(relatedTechnologies.length)}
      </small>
    </DossierCard>
  );
}

function KnowledgePathCard({
  item,
  locale
}: {
  item: KnowledgeItem;
  locale: Locale;
}) {
  const entryLang = contentLangAttr(locale);
  const relatedTechnologies = getAllTechnologies().filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );

  return (
    <DossierCard className="foundation-card">
      <DossierStampTag className="dossier-stamp-tag--muted">
        {contentLabelsByLocale[locale].difficulty[item.difficulty]}
      </DossierStampTag>
      <h3 lang={entryLang}>
        <Link href={localePath(locale, `/knowledge/${item.slug}`)}>
          {item.title}
        </Link>
      </h3>
      <p lang={entryLang}>{item.summary}</p>
      <small>
        {homeCopy[locale].knowledge.explains(relatedTechnologies.length)}
      </small>
    </DossierCard>
  );
}

export function HomePage({ locale }: { locale: Locale }) {
  const copy = homeCopy[locale];
  const tags = localizeTags(getAllTags(), locale);
  const technologies = getAllTechnologies();
  const latestDigest = getLatestPublishedDailyDigest();
  const digestData = latestDigest
    ? getDailyDigestRenderData(latestDigest)
    : undefined;
  const highPriorityTechnologies = technologies
    .filter(
      (technology) =>
        evaluateTechnologyPriority(technology).priorityLevel === "high_priority"
    )
    .slice(0, 3);
  const prioritySignals =
    highPriorityTechnologies.length > 0
      ? highPriorityTechnologies
      : technologies.slice(0, 3);
  const skills = getAllSkills().slice(0, 3);
  const knowledge = getAllKnowledge().slice(0, 4);
  const latestNews = getLatestPublicNewsItems(4);
  const digestTitle = latestDigest ? getPublicDigestTitle(latestDigest) : "";
  const digestSummary = latestDigest
    ? compactText(
        getPublicDigestSummaryPlainText(latestDigest),
        digestCardSummaryLength
      )
    : "";

  return (
    <>
      <UserPageShell
        title="AI Tech Radar"
        description={copy.shellDescription}
        sectionLabel={copy.sectionLabel}
        showHeader={false}
        className="dossier"
      >
        <section className="product-home-hero">
          <div className="product-home-hero__copy">
            <p className="eyebrow user-eyebrow">{copy.hero.eyebrow}</p>
            <h1>
              <UnbreakableTitle text={copy.hero.title} />
            </h1>
            <p>{copy.hero.lede}</p>
            <div className="product-home-hero__actions">
              <Link
                href={localePath(locale, "/digest/today")}
                className="action-button action-button--primary"
              >
                {copy.hero.readDigest}
              </Link>
              <Link
                href={localePath(locale, "/technologies")}
                className="action-link"
              >
                {copy.hero.browse}
              </Link>
            </div>
            <p className="product-home-hero__stats">
              <span>
                <strong>{technologies.length}</strong> {copy.hero.statSignals}
              </span>
              <span>
                <strong>{getAllSkills().length}</strong> {copy.hero.statSkills}
              </span>
              <span>
                <strong>{getAllKnowledge().length}</strong>{" "}
                {copy.hero.statKnowledge}
              </span>
            </p>
            <ChineseOnlyNote locale={locale}>
              {copy.chineseOnly}
            </ChineseOnlyNote>
          </div>
        </section>

        <section className="product-home-digest">
          <div className="section-heading">
            <div>
              <p className="eyebrow user-eyebrow">{copy.digest.eyebrow}</p>
              <h2>{copy.digest.heading}</h2>
            </div>
            <Link
              href={localePath(locale, "/digest/today")}
              className="action-link"
            >
              {copy.digest.open}
            </Link>
          </div>
          {/* One column: the two counts used to sit in a fixed 150-220px right
            column of their own, which left most of that column empty — the
            same shape removed from the digest hero. */}
          {latestDigest && digestData ? (
            <DossierCard className="home-digest-card">
              <span>{latestDigest.date}</span>
              <h3 lang={nameLangAttr(locale, digestTitle)}>
                <Link href={localePath(locale, `/digest/${latestDigest.date}`)}>
                  {digestTitle}
                </Link>
              </h3>
              <div className="home-digest-card__stats">
                <span>
                  {copy.digest.high(digestData.highPriorityTechnologies.length)}
                </span>
                <span>
                  {copy.digest.watch(digestData.watchTechnologies.length)}
                </span>
              </div>
              <p lang={nameLangAttr(locale, digestSummary)}>{digestSummary}</p>
            </DossierCard>
          ) : (
            <div className="empty-state empty-state--actionable">
              <strong>{copy.digest.emptyTitle}</strong>
              <p>{copy.digest.emptyBody}</p>
              <Link
                href={localePath(locale, "/technologies")}
                className="action-link"
              >
                {copy.digest.browse}
              </Link>
            </div>
          )}
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow user-eyebrow">{copy.priority.eyebrow}</p>
              <h2>{copy.priority.heading}</h2>
            </div>
            <Link
              href={localePath(locale, "/technologies")}
              className="action-link"
            >
              {copy.priority.all}
            </Link>
          </div>
          {prioritySignals.length > 0 ? (
            // Records the visit with the whole published list, not just these
            // three cards (see src/lib/visit-state.ts).
            <VisitBaselineProvider
              publishedKeys={toVisitKeys(
                technologies.map((technology) => technology.id)
              )}
            >
              <div className="home-signal-grid">
                {prioritySignals.map((technology) => (
                  <HomeTechnologyCard
                    key={technology.id}
                    technology={technology}
                    tags={tags}
                    locale={locale}
                  />
                ))}
              </div>
            </VisitBaselineProvider>
          ) : (
            <div className="empty-state empty-state--actionable">
              <strong>{copy.priority.emptyTitle}</strong>
              <p>{copy.priority.emptyBody}</p>
            </div>
          )}
        </section>

        {/* Computed in the browser from the reader's local marks and the
            recommendation data file; renders nothing for a reader without
            marks, and the page carries no card data for it. */}
        <HomeRecommendSection tags={tags} />

        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow user-eyebrow">{copy.news.eyebrow}</p>
              <h2>{copy.news.heading}</h2>
            </div>
            <Link
              href={localePath(locale, "/technologies?view=news")}
              className="action-link"
            >
              {copy.news.all}
            </Link>
          </div>
          {latestNews.length > 0 ? (
            <div className="home-news-list">
              {latestNews.map((item) => (
                <article key={item.key} className="home-news-row">
                  <div className="home-news-row__meta">
                    <span
                      className="home-news-row__source"
                      lang={nameLangAttr(locale, item.sourceName)}
                    >
                      {item.sourceName}
                    </span>
                    <span>{item.publishDate}</span>
                  </div>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    lang={nameLangAttr(locale, item.title)}
                  >
                    {item.title}
                  </a>
                </article>
              ))}
              <p className="home-news-list__note">
                {signalsCopy[locale].news.disclaimer}
              </p>
            </div>
          ) : (
            <div className="empty-state">{copy.news.empty}</div>
          )}
        </section>

        <section className="home-discovery-grid">
          <div className="home-discovery-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow user-eyebrow">{copy.skills.eyebrow}</p>
                <h2>{copy.skills.heading}</h2>
              </div>
              <Link
                href={localePath(locale, "/skills")}
                className="action-link"
              >
                {copy.skills.all}
              </Link>
            </div>
            <div className="foundation-card-list">
              {skills.map((skill) => (
                <SkillPathCard key={skill.id} skill={skill} locale={locale} />
              ))}
            </div>
          </div>

          <div className="home-discovery-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow user-eyebrow">{copy.knowledge.eyebrow}</p>
                <h2>{copy.knowledge.heading}</h2>
              </div>
              <Link
                href={localePath(locale, "/knowledge")}
                className="action-link"
              >
                {copy.knowledge.all}
              </Link>
            </div>
            <div className="foundation-card-list">
              {knowledge.map((item) => (
                <KnowledgePathCard key={item.id} item={item} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      </UserPageShell>
      <JsonLd data={buildWebSiteJsonLd(undefined, locale)} />
    </>
  );
}
