// `/technologies?q=&type=&tag=&priority=&sort=` — the curated view's filters
// and sort order, kept in the address so a filtered list survives a reload and
// can be shared.
//
// The parameters only ever pick among options the page already renders: an
// unknown type or tag, a misspelt priority, anything malformed resolves to
// "no filter", exactly as if the parameter were absent. `view` belongs to the
// page's tab strip and is never read or written here. Nothing here touches
// storage; the same URL shows every reader the same list.

import type { PriorityLevel } from "@/types/content";

export type TechnologyBrowserSort = "latest" | "priority";

export interface TechnologyBrowserQuery {
  q: string;
  type: string;
  tag: string;
  priority: PriorityLevel | "";
  sort: TechnologyBrowserSort;
}

export const defaultTechnologyBrowserQuery: TechnologyBrowserQuery = {
  q: "",
  type: "",
  tag: "",
  priority: "",
  sort: "latest"
};

const QUERY_KEYS = ["q", "type", "tag", "priority", "sort"] as const;

// A search box entry, not a document. Longer than this is not a query.
const MAX_SEARCH_LENGTH = 200;

/** Ranking v0 bands, in the order the priority sort shows them. */
export const priorityLevelOrder: readonly PriorityLevel[] = [
  "high_priority",
  "watch",
  "low_priority"
];

type SearchParamValue = string | string[] | undefined;

export type TechnologyBrowserSearchParams = Partial<
  Record<string, SearchParamValue>
>;

export interface TechnologyBrowserQueryOptions {
  /** Technology types present in the rendered list. */
  types: readonly string[];
  /** Tag ids the tag chips offer. */
  tagIds: readonly string[];
}

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(
  value: SearchParamValue,
  allowed: readonly T[]
): T | undefined {
  const raw = first(value);

  return allowed.find((candidate) => candidate === raw);
}

/**
 * The query to open with. Every value is checked against what the page can
 * show; anything else falls back to its default.
 */
export function parseTechnologyBrowserQuery(
  params: TechnologyBrowserSearchParams,
  options: TechnologyBrowserQueryOptions
): TechnologyBrowserQuery {
  const rawSearch = first(params.q) ?? "";
  const q =
    rawSearch.trim().length === 0 || rawSearch.length > MAX_SEARCH_LENGTH
      ? ""
      : rawSearch;

  return {
    q,
    type: oneOf(params.type, options.types) ?? "",
    tag: oneOf(params.tag, options.tagIds) ?? "",
    priority: oneOf(params.priority, priorityLevelOrder) ?? "",
    sort: oneOf(params.sort, ["priority"] as const) ?? "latest"
  };
}

/**
 * The address-bar URL (path + query + hash) for this query. Defaults are
 * left out, so the unfiltered list stays a bare `/technologies`; every other
 * parameter and the hash are kept as they were.
 */
export function withTechnologyBrowserQuery(
  currentHref: string,
  query: TechnologyBrowserQuery
): string {
  const url = new URL(currentHref, "http://localhost");

  for (const key of QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  if (query.q.trim().length > 0) {
    url.searchParams.set("q", query.q);
  }
  if (query.type) {
    url.searchParams.set("type", query.type);
  }
  if (query.tag) {
    url.searchParams.set("tag", query.tag);
  }
  if (query.priority) {
    url.searchParams.set("priority", query.priority);
  }
  if (query.sort !== "latest") {
    url.searchParams.set("sort", query.sort);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The list in the chosen order. `latest` keeps the incoming order (the page
 * already receives signals newest first). `priority` groups by Ranking v0
 * band — 立即关注, 值得跟踪, 背景参考 — and orders each band by publish date,
 * newest first; equal dates keep their incoming order.
 */
export function sortTechnologiesForBrowser<
  T extends { id: string; publishDate: string }
>(
  items: readonly T[],
  sort: TechnologyBrowserSort,
  levelOf: (item: T) => PriorityLevel
): T[] {
  if (sort === "latest") {
    return [...items];
  }

  const rank = new Map(
    items.map((item) => [item.id, priorityLevelOrder.indexOf(levelOf(item))])
  );

  return [...items].sort(
    (left, right) =>
      (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0) ||
      right.publishDate.localeCompare(left.publishDate)
  );
}
