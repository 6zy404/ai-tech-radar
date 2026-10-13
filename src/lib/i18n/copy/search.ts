import type { Locale } from "@/lib/i18n/locale";
import type { SearchResultType } from "@/lib/search-filter";

/* Interface text of /search. See copy/shell.ts for the pattern. */

const zh = {
  title: "全站搜索",
  /** The <title> of the bare search page. */
  metaTitle: "站内搜索",
  pageDescription:
    "检索已发布的技术信号、技能、知识与自动聚合快讯。标题或摘要含关键词的内容，和意思相近的内容，按相关程度一起排序并标出是怎么找到的。",
  metaDescription:
    "在已发布的技术信号、技能、知识和快讯里按关键词与语义相近同时查找。",
  sectionLabel: "搜索",
  queryTitle: (query: string, typeLabel?: string) =>
    `搜索「${query}」${typeLabel ? ` · ${typeLabel}` : ""}`,
  typeLabels: {
    technologies: "信号",
    skills: "技能",
    knowledge: "知识",
    news: "快讯"
  } as Record<SearchResultType, string>,
  all: "全部",
  filterLabel: "按类型筛选结果",
  keyword: "关键词",
  semantic: "语义相近",
  originalTitle: "原标题：",
  originalSummary: "原文摘要：",
  groupCount: (n: number) => `${n} 条`,
  found: (query: string, n: number) => `「${query}」共找到 ${n} 条内容。`,
  askInstead: "换成问题问雷达",
  onlySemantic: (query: string) =>
    `没有标题或摘要里含「${query}」的内容，下面是按意思找到的相近条目，未必切题。`,
  semanticUnavailable: "语义检索暂时不可用，下面只按关键词匹配。",
  emptyGroup: (typeLabel: string, query: string) =>
    `${typeLabel}里没有与「${query}」相关的内容。`,
  viewAll: (n: number) => `查看全部 ${n} 条结果`,
  groups: {
    technologies: "技术信号",
    skills: "技能",
    knowledge: "知识",
    news: "快讯"
  } as Record<SearchResultType, string>,
  noResultsTitle: (query: string) => `没有找到与「${query}」相关的内容。`,
  noResultsBody: "可以换一个更短的关键词试试，或者浏览经过编辑精选的技术信号。",
  browse: "浏览技术信号"
};

const en: typeof zh = {
  title: "Search",
  metaTitle: "Search",
  pageDescription:
    "Search the published signals, skills, knowledge and the automatic news feed. Items whose title or summary contains your words and items close in meaning are ranked together, each marked with how it was found.",
  metaDescription:
    "Search the published signals, skills, knowledge and news by keyword and by meaning at once.",
  sectionLabel: "Search",
  queryTitle: (query, typeLabel) =>
    `Search “${query}”${typeLabel ? ` · ${typeLabel}` : ""}`,
  typeLabels: {
    technologies: "Signals",
    skills: "Skills",
    knowledge: "Knowledge",
    news: "News"
  },
  all: "All",
  filterLabel: "Filter results by kind",
  keyword: "Keyword",
  semantic: "Similar meaning",
  originalTitle: "Chinese title: ",
  originalSummary: "Chinese summary: ",
  groupCount: (n) => `${n} ${n === 1 ? "result" : "results"}`,
  found: (query, n) =>
    `${n} ${n === 1 ? "result" : "results"} for “${query}”. `,
  askInstead: "Ask the radar instead",
  onlySemantic: (query) =>
    `Nothing has “${query}” in its title or summary; below are the nearest items by meaning, which may be off topic.`,
  semanticUnavailable:
    "Search by meaning is unavailable right now; the results below match keywords only.",
  emptyGroup: (typeLabel, query) =>
    `Nothing under ${typeLabel} matches “${query}”.`,
  viewAll: (n) => `See all ${n} results`,
  groups: {
    technologies: "Signals",
    skills: "Skills",
    knowledge: "Knowledge",
    news: "News"
  },
  noResultsTitle: (query) => `Nothing found for “${query}”.`,
  noResultsBody:
    "Try a shorter word, or browse the editors' curated signals. Most of the site is written in Chinese, so a Chinese term may find more.",
  browse: "Browse signals"
};

export const searchCopy: Record<Locale, typeof zh> = { zh, en };
