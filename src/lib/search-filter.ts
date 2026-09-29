import type { HybridSearchResults } from "@/lib/hybrid-search";

/**
 * The `?type=` filter on /search. The values are the result groups' own ids,
 * so the parameter, the results object and the page all name a group the
 * same way. Anything else — a typo, an array from a repeated parameter, an
 * empty string — reads as no filter: a bad link should still show results.
 */
export const searchResultTypes = [
  "technologies",
  "skills",
  "knowledge",
  "news"
] as const;

export type SearchResultType = (typeof searchResultTypes)[number];

export const searchResultTypeLabels: Record<SearchResultType, string> = {
  technologies: "信号",
  skills: "技能",
  knowledge: "知识",
  news: "快讯"
};

export function parseSearchType(raw: unknown): SearchResultType | undefined {
  return typeof raw === "string" &&
    (searchResultTypes as readonly string[]).includes(raw)
    ? (raw as SearchResultType)
    : undefined;
}

export type SearchTypeCounts = Record<SearchResultType, number>;

/** Per-group counts of the unfiltered results — what the filter row shows. */
export function getSearchTypeCounts(
  results: HybridSearchResults
): SearchTypeCounts {
  return {
    technologies: results.technologies.length,
    skills: results.skills.length,
    knowledge: results.knowledge.length,
    news: results.news.length
  };
}

/**
 * Empties every group but the chosen one. `totalCount` is left as the
 * unfiltered total: it is what the summary line reports, and the filter row
 * carries the per-group numbers.
 */
export function filterSearchResults(
  results: HybridSearchResults,
  type: SearchResultType | undefined
): HybridSearchResults {
  if (!type) {
    return results;
  }

  return {
    ...results,
    technologies: type === "technologies" ? results.technologies : [],
    skills: type === "skills" ? results.skills : [],
    knowledge: type === "knowledge" ? results.knowledge : [],
    news: type === "news" ? results.news : []
  };
}

/** A /search link for the same query, optionally narrowed to one group. */
export function buildSearchHref(
  query: string,
  type?: SearchResultType
): string {
  const params = new URLSearchParams({ q: query });

  if (type) {
    params.set("type", type);
  }

  return `/search?${params.toString()}`;
}

/**
 * True when every visible graph result was found by meaning alone, so the page
 * must say none of them matched literally. News results are keyword-only, so
 * any visible news result means something did match.
 */
export function hasOnlySemanticMatches(results: HybridSearchResults): boolean {
  const graphResults = [
    ...results.technologies,
    ...results.skills,
    ...results.knowledge
  ];

  return (
    results.news.length === 0 &&
    graphResults.length > 0 &&
    graphResults.every((item) => item.matchedBy === "semantic")
  );
}
