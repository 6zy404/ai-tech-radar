// The filter box on `/skills` and `/knowledge` — `?q=` narrows the index to
// the cards that contain every term.
//
// The rule is /search's keyword rule (`src/lib/search.ts`): the query is
// trimmed and its whitespace collapsed, split on spaces, lower-cased, and an
// entry matches only when its text contains every term. It is restated here
// rather than imported because search.ts reads the content stores and this
// module runs in the browser too; `library-filter.test.ts` checks the two
// agree. What is matched is only what the reader can see for the entry: its
// title, summary, tag names and the category it is filed under.
//
// Nothing here touches storage; the same URL shows every reader the same list.

export type LibraryKind = "skills" | "knowledge";

export interface LibraryFilterItem {
  id: string;
  /** Lower-cased text the terms are matched against (`buildLibraryFilterText`). */
  text: string;
}

export interface LibraryFilterGroup<TItem extends LibraryFilterItem> {
  id: string;
  items: readonly TItem[];
}

export interface LibraryFilterResult<
  TItem extends LibraryFilterItem,
  TGroup extends LibraryFilterGroup<TItem>
> {
  /** Groups that still hold at least one entry, each with only its matches. */
  groups: Array<TGroup & { items: TItem[] }>;
  matchCount: number;
  totalCount: number;
}

// A filter box entry, not a document. Longer than this is not a query.
const MAX_QUERY_LENGTH = 200;

/** Trimmed, whitespace collapsed — the same normalisation as /search. */
export function normalizeLibraryQuery(raw: string | undefined): string {
  return raw?.trim().replace(/\s+/g, " ") ?? "";
}

export function parseLibraryFilterTerms(query: string): string[] {
  return normalizeLibraryQuery(query)
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 0);
}

/** One lower-cased string of everything an entry is matched on. */
export function buildLibraryFilterText(
  parts: ReadonlyArray<string | undefined>
): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

/** True when `text` contains every term; no terms matches everything. */
export function matchesLibraryFilter(
  text: string,
  terms: readonly string[]
): boolean {
  return terms.every((term) => text.includes(term));
}

/**
 * The groups with only their matching entries, in their original order.
 * A group left with no entries is dropped, so the page never shows a
 * heading over nothing.
 */
export function filterLibraryGroups<
  TItem extends LibraryFilterItem,
  TGroup extends LibraryFilterGroup<TItem>
>(
  groups: readonly TGroup[],
  query: string
): LibraryFilterResult<TItem, TGroup> {
  const terms = parseLibraryFilterTerms(query);
  let matchCount = 0;
  let totalCount = 0;
  const kept: Array<TGroup & { items: TItem[] }> = [];

  for (const group of groups) {
    totalCount += group.items.length;
    const items = group.items.filter((item) =>
      matchesLibraryFilter(item.text, terms)
    );

    matchCount += items.length;

    if (items.length > 0) {
      kept.push({ ...group, items });
    }
  }

  return { groups: kept, matchCount, totalCount };
}

type SearchParamValue = string | string[] | undefined;

/**
 * The query to open with, from the page's `searchParams`. A repeated
 * parameter takes its first value; a blank or overlong one reads as none.
 */
export function parseLibraryFilterQuery(value: SearchParamValue): string {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || raw.length > MAX_QUERY_LENGTH) {
    return "";
  }

  return normalizeLibraryQuery(raw).length > 0 ? raw : "";
}

/**
 * The address-bar URL (path + query + hash) for this filter. An empty filter
 * leaves no `q`, so the unfiltered page stays a bare `/skills`; every other
 * parameter and the hash are kept.
 */
export function withLibraryFilterQuery(
  currentHref: string,
  query: string
): string {
  const url = new URL(currentHref, "http://localhost");

  url.searchParams.delete("q");

  if (normalizeLibraryQuery(query).length > 0) {
    url.searchParams.set("q", query);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/** The same words on /search, narrowed to this page's kind. */
export function librarySearchHref(kind: LibraryKind, query: string): string {
  const params = new URLSearchParams({
    q: normalizeLibraryQuery(query),
    type: kind
  });

  return `/search?${params.toString()}`;
}
