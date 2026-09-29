import Link from "next/link";

import { NewsCardSignalLink, NewsCardTags } from "@/components/news-card-parts";
import { SearchGlyph } from "@/components/search-glyph";
import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { HighlightedText } from "@/components/highlighted-text";
import { UserPageShell } from "@/components/user-page-shell";
import {
  searchPublicContentHybrid,
  type HybridSearchResultLink
} from "@/lib/hybrid-search";
import { newsDisclaimer, type PublicNewsItem } from "@/lib/news";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  return buildPageMetadata({
    title: query ? `搜索「${query}」` : "站内搜索",
    description:
      "在已发布的技术信号、技能、知识和快讯里按关键词与语义相近同时查找。",
    path: "/search",
    // A results page is not a page worth indexing on its own.
    noIndex: query.length > 0
  });
}

function MatchReasonTags({ item }: { item: HybridSearchResultLink }) {
  return (
    <div className="search-result__reasons">
      {item.matchedBy !== "semantic" ? (
        <DossierStampTag>关键词</DossierStampTag>
      ) : null}
      {item.matchedBy !== "keyword" ? (
        <DossierStampTag className="dossier-stamp-tag--muted">
          语义相近
        </DossierStampTag>
      ) : null}
    </div>
  );
}

function SearchResultCard({
  item,
  terms
}: {
  item: HybridSearchResultLink;
  terms: string[];
}) {
  // A result found by meaning alone has no literal hit to point at; marking
  // a stray substring there would claim a match that did not happen.
  const hitTerms = item.matchedBy === "semantic" ? [] : terms;

  return (
    <DossierCard className="search-result">
      <MatchReasonTags item={item} />
      <h3>
        <Link href={item.href}>
          <HighlightedText text={item.title} terms={hitTerms} />
        </Link>
      </h3>
      {item.summary ? (
        <p>
          <HighlightedText text={item.summary} terms={hitTerms} />
        </p>
      ) : null}
      {item.meta ? (
        <div className="search-result__meta">{item.meta}</div>
      ) : null}
      <NewsCardTags tags={item.tags} terms={hitTerms} />
    </DossierCard>
  );
}

function SearchNewsCard({
  item,
  terms
}: {
  item: PublicNewsItem;
  terms: string[];
}) {
  return (
    <DossierCard className="search-result">
      <h3>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">
          <HighlightedText text={item.title} terms={terms} />
        </a>
      </h3>
      {item.summary ? (
        <p>
          <HighlightedText text={item.summary} terms={terms} />
        </p>
      ) : null}
      <div className="search-result__meta">
        <span className="news-card__source">{item.sourceName}</span>
        <span>{item.publishDate}</span>
      </div>
      <NewsCardTags tags={item.tags} terms={terms} />
      <NewsCardSignalLink technology={item.publishedTechnology} />
    </DossierCard>
  );
}

function SearchResultGroup({
  title,
  count,
  notice,
  children
}: {
  title: string;
  count: number;
  notice?: string;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <section className="search-group">
      <div className="search-group__heading">
        <h2>{title}</h2>
        <span>{count} 条</span>
      </div>
      {notice ? <p className="search-group__notice">{notice}</p> : null}
      <div className="search-group__list">{children}</div>
    </section>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const results = await searchPublicContentHybrid(q);
  const hasQuery = results.query.length > 0;
  const graphResults = [
    ...results.technologies,
    ...results.skills,
    ...results.knowledge
  ];
  // Every graph result came from meaning alone: say so, because on a query the
  // site has nothing for, those are the nearest items rather than matches.
  const onlySemantic =
    results.news.length === 0 &&
    graphResults.length > 0 &&
    graphResults.every((item) => item.matchedBy === "semantic");

  return (
    <UserPageShell
      title="全站搜索"
      description="检索已发布的技术信号、技能、知识与自动聚合快讯。标题或摘要含关键词的内容，和意思相近的内容，按相关程度一起排序并标出是怎么找到的。"
      sectionLabel="搜索"
      className="search-page dossier"
    >
      <form className="search-form" action="/search" method="get">
        <div className="dossier-search">
          <SearchGlyph />
          <input
            type="search"
            name="q"
            defaultValue={results.query}
            placeholder="输入关键词，如：推理、Agent、上下文"
            aria-label="搜索关键词"
          />
        </div>
        <button type="submit" className="action-button action-button--primary">
          搜索
        </button>
      </form>

      {hasQuery ? (
        results.totalCount > 0 ? (
          <>
            <p className="search-page__summary">
              「{results.query}」共找到 {results.totalCount} 条内容。
              <Link
                className="search-page__ask"
                href={`/ask?q=${encodeURIComponent(results.query)}`}
              >
                换成问题问雷达
              </Link>
            </p>
            {onlySemantic ? (
              <p className="search-group__notice">
                {`没有标题或摘要里含「${results.query}」的内容，下面是按意思找到的相近条目，未必切题。`}
              </p>
            ) : null}
            {results.semanticAvailable ? null : (
              <p className="search-group__notice">
                语义检索暂时不可用，下面只按关键词匹配。
              </p>
            )}
            <SearchResultGroup
              title="技术信号"
              count={results.technologies.length}
            >
              {results.technologies.map((item) => (
                <SearchResultCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup title="技能" count={results.skills.length}>
              {results.skills.map((item) => (
                <SearchResultCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup title="知识" count={results.knowledge.length}>
              {results.knowledge.map((item) => (
                <SearchResultCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup
              title="快讯"
              count={results.news.length}
              notice={newsDisclaimer}
            >
              {results.news.map((item) => (
                <SearchNewsCard
                  key={item.key}
                  item={item}
                  terms={results.terms}
                />
              ))}
            </SearchResultGroup>
          </>
        ) : (
          <div className="empty-state empty-state--actionable">
            <strong>没有找到与「{results.query}」相关的内容。</strong>
            <p>可以换一个更短的关键词试试，或者浏览经过编辑精选的技术信号。</p>
            <Link href="/technologies" className="action-link">
              浏览技术信号
            </Link>
          </div>
        )
      ) : null}
    </UserPageShell>
  );
}
