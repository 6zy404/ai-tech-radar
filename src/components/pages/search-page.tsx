import Link from "next/link";

import { NewsCardSignalLink, NewsCardTags } from "@/components/news-card-parts";
import { DossierCard } from "@/components/dossier-card";
import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { HighlightedText } from "@/components/highlighted-text";
import { LangSpan } from "@/components/lang-scope";
import { SiteSearchForm } from "@/components/site-search-form";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";
import {
  searchPublicContentHybrid,
  type HybridSearchResultLink
} from "@/lib/hybrid-search";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { searchCopy } from "@/lib/i18n/copy/search";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";
import { localizeTag } from "@/lib/i18n/topic-names";
import type { PublicNewsItem } from "@/lib/news";
import {
  localizeSearchLink,
  type LocalizedSearchFields,
  type SearchGroup
} from "@/lib/search";
import {
  buildSearchHref,
  filterSearchResults,
  getSearchTypeCounts,
  hasOnlySemanticMatches,
  parseSearchType,
  searchResultTypes,
  type SearchResultType,
  type SearchTypeCounts
} from "@/lib/search-filter";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";
import { getSearchCardText } from "@/lib/search-card-text";
import { getTechnologyTitleForLocale } from "@/lib/technology-localization";

export interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[] }>;
}

export async function generateSearchPageMetadata(
  locale: Locale,
  { searchParams }: SearchPageProps
): Promise<Metadata> {
  const copy = searchCopy[locale];
  const { q, type: rawType } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const type = parseSearchType(rawType);

  return buildPageMetadata({
    title: query
      ? copy.queryTitle(query, type ? copy.typeLabels[type] : undefined)
      : copy.metaTitle,
    description: copy.metaDescription,
    path: "/search",
    // A results page is not a page worth indexing on its own.
    noIndex: query.length > 0,
    locale
  });
}

type ResultLink = HybridSearchResultLink & LocalizedSearchFields;

function MatchReasonTags({
  item,
  locale
}: {
  item: HybridSearchResultLink;
  locale: Locale;
}) {
  const copy = searchCopy[locale];

  return (
    <div className="search-result__reasons">
      {item.matchedBy !== "semantic" ? (
        <DossierStampTag>{copy.keyword}</DossierStampTag>
      ) : null}
      {item.matchedBy !== "keyword" ? (
        <DossierStampTag className="dossier-stamp-tag--muted">
          {copy.semantic}
        </DossierStampTag>
      ) : null}
    </div>
  );
}

function SearchResultCard({
  item,
  terms,
  locale
}: {
  item: ResultLink;
  terms: string[];
  locale: Locale;
}) {
  const copy = searchCopy[locale];
  // A result found by meaning alone has no literal hit to point at; marking
  // a stray substring there would claim a match that did not happen.
  const hitTerms = item.matchedBy === "semantic" ? [] : terms;
  // Keyword search also matches the summary past the card's cut and the
  // title and summary the card does not show. When a term hit only one of
  // those, the card shows it, or the card has no visible reason.
  const { summary, originalTitle, originalSummary } = getSearchCardText(
    item,
    hitTerms
  );

  return (
    <DossierCard className="search-result">
      <MatchReasonTags item={item} locale={locale} />
      <h3 lang={item.titleLang}>
        <Link href={item.href}>
          <HighlightedText text={item.title} terms={hitTerms} />
        </Link>
      </h3>
      {originalTitle ? (
        <div className="search-result__original-title">
          {copy.originalTitle}
          <LangSpan lang={nameLangAttr(locale, originalTitle)}>
            <HighlightedText text={originalTitle} terms={hitTerms} />
          </LangSpan>
        </div>
      ) : null}
      {summary ? (
        <p lang={item.summaryLang}>
          <HighlightedText text={summary} terms={hitTerms} />
        </p>
      ) : null}
      {originalSummary ? (
        <div className="search-result__original-summary">
          {copy.originalSummary}
          <LangSpan lang={nameLangAttr(locale, originalSummary)}>
            <HighlightedText text={originalSummary} terms={hitTerms} />
          </LangSpan>
        </div>
      ) : null}
      {item.meta ? (
        <div
          className="search-result__meta"
          lang={nameLangAttr(locale, item.meta)}
        >
          {item.meta}
        </div>
      ) : null}
      <NewsCardTags tags={item.tags} terms={hitTerms} locale={locale} />
    </DossierCard>
  );
}

function SearchNewsCard({
  item,
  terms,
  locale
}: {
  item: PublicNewsItem;
  terms: string[];
  locale: Locale;
}) {
  return (
    <DossierCard className="search-result">
      <h3 lang={nameLangAttr(locale, item.title)}>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">
          <HighlightedText text={item.title} terms={terms} />
        </a>
      </h3>
      {item.summary ? (
        <p lang={nameLangAttr(locale, item.summary)}>
          <HighlightedText text={item.summary} terms={terms} />
        </p>
      ) : null}
      <div className="search-result__meta">
        <span
          className="news-card__source"
          lang={nameLangAttr(locale, item.sourceName)}
        >
          {item.sourceName}
        </span>
        <span>{item.publishDate}</span>
      </div>
      <NewsCardTags tags={item.tags} terms={terms} locale={locale} />
      <NewsCardSignalLink
        technology={item.publishedTechnology}
        locale={locale}
      />
    </DossierCard>
  );
}

function SearchResultGroup({
  title,
  count,
  notice,
  locale,
  children
}: {
  title: string;
  count: number;
  notice?: string;
  locale: Locale;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <section className="search-group">
      <div className="search-group__heading">
        <h2>{title}</h2>
        <span>{searchCopy[locale].groupCount(count)}</span>
      </div>
      {notice ? <p className="search-group__notice">{notice}</p> : null}
      <div className="search-group__list">{children}</div>
    </section>
  );
}

/**
 * One row of links, one per result group, counted on the unfiltered results.
 * A group with nothing in it stays in the row, muted and not a link, so the
 * row has the same entries for every query.
 */
function SearchTypeFilter({
  query,
  active,
  counts,
  locale
}: {
  query: string;
  active: SearchResultType | undefined;
  counts: SearchTypeCounts;
  locale: Locale;
}) {
  const copy = searchCopy[locale];
  const options = [
    {
      value: "all",
      label: copy.all,
      href: localePath(locale, buildSearchHref(query))
    },
    ...searchResultTypes.map((type) => {
      const empty = counts[type] === 0 && active !== type;

      return {
        value: type,
        label: `${copy.typeLabels[type]} ${counts[type]}`,
        href: empty
          ? undefined
          : localePath(locale, buildSearchHref(query, type)),
        disabled: empty
      };
    })
  ];

  return (
    <DossierCategoryChips
      className="search-type-filter"
      ariaLabel={copy.filterLabel}
      options={options}
      active={active ?? "all"}
    />
  );
}

/** News items as the English site shows them: topic names and the signal
    an item became, in English. Their own text is the source's. */
function localizeNewsItem(
  item: PublicNewsItem,
  locale: Locale
): PublicNewsItem {
  if (locale === "zh") {
    return item;
  }

  const englishTagNames = new Map(
    getAllTags().map((tag) => [tag.name, localizeTag(tag, locale).name])
  );
  const technology = item.publishedTechnology
    ? getAllTechnologies().find(
        (candidate) => candidate.slug === item.publishedTechnology?.slug
      )
    : undefined;

  return {
    ...item,
    tags: item.tags.map((name) => englishTagNames.get(name) ?? name),
    publishedTechnology:
      item.publishedTechnology && technology
        ? {
            slug: item.publishedTechnology.slug,
            title: getTechnologyTitleForLocale(technology, locale).text
          }
        : item.publishedTechnology
  };
}

export async function SearchPage({
  searchParams,
  locale
}: SearchPageProps & { locale: Locale }) {
  const copy = searchCopy[locale];
  const { q, type: rawType } = await searchParams;
  const activeType = parseSearchType(rawType);
  const allResults = await searchPublicContentHybrid(
    typeof q === "string" ? q : undefined
  );
  const counts = getSearchTypeCounts(allResults);
  const results = filterSearchResults(allResults, activeType);
  const hasQuery = results.query.length > 0;
  // Every visible graph result came from meaning alone: say so, because on a
  // query the site has nothing for, those are the nearest items rather than
  // matches. Judged on what is shown, so a filter can change the answer.
  const onlySemantic = hasOnlySemanticMatches(results);
  // Only reachable by a hand-written URL: the row never links an empty group.
  const activeTypeEmpty = activeType !== undefined && counts[activeType] === 0;
  const localize = (items: HybridSearchResultLink[], group: SearchGroup) =>
    items.map((item) => localizeSearchLink(item, group, locale));

  return (
    <UserPageShell
      title={copy.title}
      description={copy.pageDescription}
      sectionLabel={copy.sectionLabel}
      className="search-page dossier"
    >
      <SiteSearchForm defaultValue={results.query} locale={locale} />

      {hasQuery ? (
        results.totalCount > 0 ? (
          <>
            <SearchTypeFilter
              query={results.query}
              active={activeType}
              counts={counts}
              locale={locale}
            />
            <p className="search-page__summary">
              {copy.found(results.query, results.totalCount)}
              <Link
                className="search-page__ask"
                href={localePath(
                  locale,
                  `/ask?q=${encodeURIComponent(results.query)}`
                )}
              >
                {copy.askInstead}
              </Link>
            </p>
            {onlySemantic ? (
              <p className="search-group__notice">
                {copy.onlySemantic(results.query)}
              </p>
            ) : null}
            {/* News is keyword-only, so the notice says nothing about it. */}
            {results.semanticAvailable || activeType === "news" ? null : (
              <p className="search-group__notice">{copy.semanticUnavailable}</p>
            )}
            {activeTypeEmpty ? (
              <div className="empty-state empty-state--actionable">
                <strong>
                  {copy.emptyGroup(copy.typeLabels[activeType], results.query)}
                </strong>
                <Link
                  href={localePath(locale, buildSearchHref(results.query))}
                  className="action-link"
                >
                  {copy.viewAll(results.totalCount)}
                </Link>
              </div>
            ) : null}
            <SearchResultGroup
              title={copy.groups.technologies}
              count={results.technologies.length}
              locale={locale}
            >
              {localize(results.technologies, "technologies").map((item) => (
                <SearchResultCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                  locale={locale}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup
              title={copy.groups.skills}
              count={results.skills.length}
              locale={locale}
            >
              {localize(results.skills, "skills").map((item) => (
                <SearchResultCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                  locale={locale}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup
              title={copy.groups.knowledge}
              count={results.knowledge.length}
              locale={locale}
            >
              {localize(results.knowledge, "knowledge").map((item) => (
                <SearchResultCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                  locale={locale}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup
              title={copy.groups.news}
              count={results.news.length}
              notice={signalsCopy[locale].news.disclaimer}
              locale={locale}
            >
              {results.news.map((item) => (
                <SearchNewsCard
                  key={item.key}
                  item={localizeNewsItem(item, locale)}
                  terms={results.terms}
                  locale={locale}
                />
              ))}
            </SearchResultGroup>
          </>
        ) : (
          <div className="empty-state empty-state--actionable">
            <strong>{copy.noResultsTitle(results.query)}</strong>
            <p>{copy.noResultsBody}</p>
            <Link
              href={localePath(locale, "/technologies")}
              className="action-link"
            >
              {copy.browse}
            </Link>
          </div>
        )
      ) : null}
    </UserPageShell>
  );
}
