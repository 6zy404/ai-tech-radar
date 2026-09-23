import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UserPageShell } from "@/components/user-page-shell";
import {
  searchPublicContentHybrid,
  type HybridSearchResultLink
} from "@/lib/hybrid-search";
import { newsDisclaimer, type PublicNewsItem } from "@/lib/news";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = "force-dynamic";

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

function SearchResultCard({ item }: { item: HybridSearchResultLink }) {
  return (
    <DossierCard className="search-result">
      <MatchReasonTags item={item} />
      <h3>
        <Link href={item.href}>{item.title}</Link>
      </h3>
      {item.summary ? <p>{item.summary}</p> : null}
      {item.meta ? (
        <div className="search-result__meta">{item.meta}</div>
      ) : null}
      {item.tags.length > 0 ? (
        <div className="news-card__tags">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
    </DossierCard>
  );
}

function SearchNewsCard({ item }: { item: PublicNewsItem }) {
  return (
    <DossierCard className="search-result">
      <h3>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">
          {item.title}
        </a>
      </h3>
      {item.summary ? <p>{item.summary}</p> : null}
      <div className="search-result__meta">
        <span className="news-card__source">{item.sourceName}</span>
        <span>{item.publishDate}</span>
      </div>
      {item.tags.length > 0 ? (
        <div className="news-card__tags">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {item.publishedTechnology ? (
        <Link
          className="news-card__signal"
          href={`/technologies/${item.publishedTechnology.slug}`}
        >
          已收录为精选技术信号：{item.publishedTechnology.title}
        </Link>
      ) : null}
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
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="6.5"
              cy="6.5"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <line
              x1="10"
              y1="10"
              x2="13.5"
              y2="13.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
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
                <SearchResultCard key={item.key} item={item} />
              ))}
            </SearchResultGroup>
            <SearchResultGroup title="技能" count={results.skills.length}>
              {results.skills.map((item) => (
                <SearchResultCard key={item.key} item={item} />
              ))}
            </SearchResultGroup>
            <SearchResultGroup title="知识" count={results.knowledge.length}>
              {results.knowledge.map((item) => (
                <SearchResultCard key={item.key} item={item} />
              ))}
            </SearchResultGroup>
            <SearchResultGroup
              title="快讯"
              count={results.news.length}
              notice={newsDisclaimer}
            >
              {results.news.map((item) => (
                <SearchNewsCard key={item.key} item={item} />
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
