import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies
} from "@/lib/content";
import { compactText } from "@/lib/compact-text";
import { getPublicNewsItems, type PublicNewsItem } from "@/lib/news";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";

/**
 * 公开全站搜索（确定性关键词匹配）。
 *
 * 只检索已经允许公开的内容：已发布技术信号、技能、知识（图谱三类），
 * 以及快讯（严格复用 src/lib/news.ts 的公开映射，候选内部字段不会经由
 * 搜索进入公开面）。匹配范围限定为标题、摘要与话题标签的大小写不敏感
 * 子串匹配；多个关键词按空格分隔并要求全部命中（AND）。
 */
export interface SearchResultLink {
  key: string;
  title: string;
  summary?: string;
  href: string;
  tags: string[];
  meta?: string;
}

export interface PublicSearchResults {
  query: string;
  terms: string[];
  technologies: SearchResultLink[];
  skills: SearchResultLink[];
  knowledge: SearchResultLink[];
  news: PublicNewsItem[];
  totalCount: number;
}

const maxSummaryLength = 160;

export function normalizeSearchQuery(rawQuery: string | undefined): string {
  return rawQuery?.trim().replace(/\s+/g, " ") ?? "";
}

function parseSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 0);
}

function matchesAllTerms(haystack: string, terms: string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

function buildHaystack(parts: (string | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

function truncateSummary(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return compactText(trimmed, maxSummaryLength);
}

function getTagDisplayNames(tagIds: string[]): string[] {
  const allTags = getAllTags();

  return tagIds
    .map((tagId) => allTags.find((tag) => tag.id === tagId)?.name ?? tagId)
    .slice(0, 4);
}

export function searchPublicContent(
  rawQuery: string | undefined,
  now = new Date()
): PublicSearchResults {
  const query = normalizeSearchQuery(rawQuery);
  const terms = parseSearchTerms(query);

  if (terms.length === 0) {
    return {
      query,
      terms,
      technologies: [],
      skills: [],
      knowledge: [],
      news: [],
      totalCount: 0
    };
  }

  const technologies: SearchResultLink[] = [];

  for (const technology of getAllTechnologies()) {
    const tagNames = getTagDisplayNames(technology.tags);
    const haystack = buildHaystack([
      technology.title.original,
      technology.title.zh,
      technology.summary.original,
      technology.summary.zh,
      ...tagNames
    ]);

    if (matchesAllTerms(haystack, terms)) {
      technologies.push({
        key: technology.id,
        title: getPreferredTechnologyTitle(technology),
        summary: truncateSummary(getPreferredTechnologySummary(technology)),
        href: `/technologies/${technology.slug}`,
        tags: tagNames,
        meta: `${technology.sourceName} · ${technology.publishDate}`
      });
    }
  }

  const skills: SearchResultLink[] = [];

  for (const skill of getAllSkills()) {
    const tagNames = getTagDisplayNames(skill.tags);
    const haystack = buildHaystack([skill.title, skill.summary, ...tagNames]);

    if (matchesAllTerms(haystack, terms)) {
      skills.push({
        key: skill.id,
        title: skill.title,
        summary: truncateSummary(skill.summary),
        href: `/skills/${skill.slug}`,
        tags: tagNames
      });
    }
  }

  const knowledge: SearchResultLink[] = [];

  for (const knowledgeItem of getAllKnowledge()) {
    const tagNames = getTagDisplayNames(knowledgeItem.tags);
    const haystack = buildHaystack([
      knowledgeItem.title,
      knowledgeItem.summary,
      ...tagNames
    ]);

    if (matchesAllTerms(haystack, terms)) {
      knowledge.push({
        key: knowledgeItem.id,
        title: knowledgeItem.title,
        summary: truncateSummary(knowledgeItem.summary),
        href: `/knowledge/${knowledgeItem.slug}`,
        tags: tagNames
      });
    }
  }

  const news = getPublicNewsItems(now).filter((item) =>
    matchesAllTerms(
      buildHaystack([item.title, item.summary, ...item.tags]),
      terms
    )
  );

  return {
    query,
    terms,
    technologies,
    skills,
    knowledge,
    news,
    totalCount:
      technologies.length + skills.length + knowledge.length + news.length
  };
}
