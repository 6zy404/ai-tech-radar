"use client";

import Link from "next/link";
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useState,
  type ReactNode
} from "react";

import { DossierSearchInput } from "@/components/dossier-search-input";
import {
  filterLibraryGroups,
  librarySearchHref,
  normalizeLibraryQuery,
  withLibraryFilterQuery,
  type LibraryFilterItem,
  type LibraryKind
} from "@/lib/library-filter";

export interface LibraryFilterEntry extends LibraryFilterItem {
  /** The card, rendered on the server exactly as before the filter existed. */
  card: ReactNode;
}

export interface LibraryFilterSection {
  id: string;
  /** The section's `.skills-library-section__header`. */
  header: ReactNode;
  items: LibraryFilterEntry[];
}

interface LibraryFilterProps {
  kind: LibraryKind;
  /** Accessible name of the box, e.g. 筛选技能. */
  label: string;
  placeholder: string;
  /** Measure word plus noun for the count line, e.g. 项技能 / 个概念. */
  countUnit: string;
  /** Noun for the no-match line, e.g. 技能 / 概念. */
  noun: string;
  /** `?q=` as the server read it, so the first paint is already filtered. */
  initialQuery: string;
  sections: LibraryFilterSection[];
}

/**
 * The grouped card list of `/skills` and `/knowledge` with a filter box
 * above it. The two pages are siblings, so they share this one component;
 * each passes its own sections and copy. The filter lives in `?q=` (kept in
 * step with replaceState, never in storage), and a group with no matching
 * card is hidden whole.
 */
export function LibraryFilter({
  kind,
  label,
  placeholder,
  countUnit,
  noun,
  initialQuery,
  sections
}: LibraryFilterProps) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const { groups, matchCount, totalCount } = filterLibraryGroups(
    sections,
    deferredQuery
  );
  const shownQuery = normalizeLibraryQuery(deferredQuery);
  const isFiltering = shownQuery.length > 0;

  // The address follows the box so a filtered page survives a reload and can
  // be shared. replaceState, not a navigation: narrowing a list adds no
  // history entries and does not re-render on the server.
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const next = withLibraryFilterQuery(window.location.href, deferredQuery);

    if (next !== `${pathname}${search}${hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [deferredQuery]);

  return (
    <>
      <div className="library-filter">
        <label className="library-filter__field">
          <span className="library-filter__label">{label}</span>
          <DossierSearchInput
            value={query}
            onChange={setQuery}
            placeholder={placeholder}
          />
        </label>
        <p className="library-filter__status" role="status">
          {!isFiltering ? null : matchCount > 0 ? (
            <>
              筛出 {matchCount} / {totalCount} {countUnit}
            </>
          ) : (
            <>
              没有{noun}含「{shownQuery}」。
              <Link href={librarySearchHref(kind, shownQuery)}>
                到全站搜索找「{shownQuery}」
              </Link>
            </>
          )}
        </p>
      </div>

      {groups.length > 0 ? (
        <div className="skills-library-groups">
          {groups.map((section) => (
            <section className="skills-library-section" key={section.id}>
              {section.header}
              <div className="skills-library-card-grid">
                {section.items.map((item) => (
                  <Fragment key={item.id}>{item.card}</Fragment>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}
