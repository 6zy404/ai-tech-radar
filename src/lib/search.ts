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

export type SearchGroup = "technologies" | "skills" | "knowledge";

export const searchGroups: SearchGroup[] = [
  "technologies",
  "skills",
  "knowledge"
];

/**
 * One searchable item. Keyword and semantic search read the same documents,
 * so the two can only disagree about ranking, never about what exists.
 */
export interface SearchDocument {
  group: SearchGroup;
  /** `T:` / `S:` / `K:` plus the public slug — what the eval set labels. */
  evalKey: string;
  link: SearchResultLink;
  /** Lower-cased title, for ranking title hits above summary/tag hits. */
  titleText: string;
  /** Lower-cased title + summary + tag names: what keyword search matches. */
  haystack: string;
  /** What gets embedded: both title languages, the summary, the tags. */
  embedText: string;
}

const maxEmbedTextLength = 400;

function buildEmbedText(parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  const unique = parts
    .map((part) => part?.replace(/\s+/g, " ").trim())
    .filter((part): part is string => {
      if (!part || seen.has(part)) {
        return false;
      }
      seen.add(part);
      return true;
    });

  return unique.join("\n").slice(0, maxEmbedTextLength);
}

export function getSearchDocuments(): SearchDocument[] {
  const documents: SearchDocument[] = [];

  for (const technology of getAllTechnologies()) {
    const tagNames = getTagDisplayNames(technology.tags);
    const title = getPreferredTechnologyTitle(technology);
    const summary = getPreferredTechnologySummary(technology);

    documents.push({
      group: "technologies",
      evalKey: `T:${technology.slug}`,
      link: {
        key: technology.id,
        title,
        summary: truncateSummary(summary),
        href: `/technologies/${technology.slug}`,
        tags: tagNames,
        meta: `${technology.sourceName} · ${technology.publishDate}`
      },
      titleText: buildHaystack([
        technology.title.original,
        technology.title.zh
      ]),
      haystack: buildHaystack([
        technology.title.original,
        technology.title.zh,
        technology.summary.original,
        technology.summary.zh,
        ...tagNames
      ]),
      embedText: buildEmbedText([
        title,
        technology.title.original,
        summary,
        tagNames.join(" ")
      ])
    });
  }

  for (const skill of getAllSkills()) {
    const tagNames = getTagDisplayNames(skill.tags);

    documents.push({
      group: "skills",
      evalKey: `S:${skill.slug}`,
      link: {
        key: skill.id,
        title: skill.title,
        summary: truncateSummary(skill.summary),
        href: `/skills/${skill.slug}`,
        tags: tagNames
      },
      titleText: buildHaystack([skill.title]),
      haystack: buildHaystack([skill.title, skill.summary, ...tagNames]),
      embedText: buildEmbedText([
        skill.title,
        skill.summary,
        tagNames.join(" ")
      ])
    });
  }

  for (const knowledgeItem of getAllKnowledge()) {
    const tagNames = getTagDisplayNames(knowledgeItem.tags);

    documents.push({
      group: "knowledge",
      evalKey: `K:${knowledgeItem.slug}`,
      link: {
        key: knowledgeItem.id,
        title: knowledgeItem.title,
        summary: truncateSummary(knowledgeItem.summary),
        href: `/knowledge/${knowledgeItem.slug}`,
        tags: tagNames
      },
      titleText: buildHaystack([knowledgeItem.title]),
      haystack: buildHaystack([
        knowledgeItem.title,
        knowledgeItem.summary,
        ...tagNames
      ]),
      embedText: buildEmbedText([
        knowledgeItem.title,
        knowledgeItem.summary,
        tagNames.join(" ")
      ])
    });
  }

  return documents;
}

export function parseQueryTerms(rawQuery: string | undefined): {
  query: string;
  terms: string[];
} {
  const query = normalizeSearchQuery(rawQuery);

  return { query, terms: parseSearchTerms(query) };
}

export function documentMatchesTerms(
  document: Pick<SearchDocument, "haystack">,
  terms: string[]
): boolean {
  return terms.length > 0 && matchesAllTerms(document.haystack, terms);
}

export function searchPublicNews(
  terms: string[],
  now = new Date()
): PublicNewsItem[] {
  if (terms.length === 0) {
    return [];
  }

  return getPublicNewsItems(now).filter((item) =>
    matchesAllTerms(
      buildHaystack([item.title, item.summary, ...item.tags]),
      terms
    )
  );
}

export function searchPublicContent(
  rawQuery: string | undefined,
  now = new Date()
): PublicSearchResults {
  const { query, terms } = parseQueryTerms(rawQuery);
  const grouped: Record<SearchGroup, SearchResultLink[]> = {
    technologies: [],
    skills: [],
    knowledge: []
  };

  if (terms.length > 0) {
    for (const document of getSearchDocuments()) {
      if (documentMatchesTerms(document, terms)) {
        grouped[document.group].push(document.link);
      }
    }
  }

  const news = searchPublicNews(terms, now);

  return {
    query,
    terms,
    ...grouped,
    news,
    totalCount:
      grouped.technologies.length +
      grouped.skills.length +
      grouped.knowledge.length +
      news.length
  };
}
