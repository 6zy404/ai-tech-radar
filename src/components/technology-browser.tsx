"use client";

import { useDeferredValue, useEffect, useState } from "react";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierSearchInput } from "@/components/dossier-search-input";
import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { ReadFilterToggle } from "@/components/read-filter-toggle";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import {
  SignalShortcutHelp,
  SignalShortcutHint
} from "@/components/signal-shortcut-help";
import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { useReadingState } from "@/components/use-reading-state";
import { useSignalShortcuts } from "@/components/use-signal-shortcuts";
import { useVisitBaseline } from "@/components/visit-baseline";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { applyReadFilter, countReadTechnologies } from "@/lib/reading-state";
import {
  getPublisherSlug,
  getSignalPublisherName
} from "@/lib/source-directory";
import {
  defaultTechnologyBrowserQuery,
  priorityLevelOrder,
  sortTechnologiesForBrowser,
  withTechnologyBrowserQuery,
  type TechnologyBrowserQuery,
  type TechnologyBrowserSort
} from "@/lib/technology-browser-query";
import {
  countNewSinceLastVisit,
  isNewSinceLastVisit,
  toVisitKeys
} from "@/lib/visit-state";
import {
  getTechnologySearchText,
  getTechnologyTypeLabel,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type { PriorityLevel, TechnologyItem, TopicTag } from "@/types/content";

interface TechnologyBrowserProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
  /** Filters and sort from the address, already validated by the page. */
  initialQuery?: TechnologyBrowserQuery;
}

// The labels say what the order is built from: the publish date, or the
// fixed Ranking v0 bands every reader sees. Neither is a recommendation.
const sortOptions: { value: TechnologyBrowserSort; label: string }[] = [
  { value: "latest", label: "最新发布" },
  { value: "priority", label: "按优先级档位" }
];

export function TechnologyBrowser({
  technologies,
  tags,
  initialQuery = defaultTechnologyBrowserQuery
}: TechnologyBrowserProps) {
  const [mode, setMode] = useState<TechnologyContentMode>("zh");
  const [searchText, setSearchText] = useState(initialQuery.q);
  const [typeFilter, setTypeFilter] = useState(initialQuery.type);
  const [tagFilter, setTagFilter] = useState(initialQuery.tag);
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "">(
    initialQuery.priority
  );
  const [publisherFilter, setPublisherFilter] = useState(
    initialQuery.publisher
  );
  const [sort, setSort] = useState<TechnologyBrowserSort>(initialQuery.sort);
  const [hideRead, setHideRead] = useState(false);
  const deferredSearchText = useDeferredValue(searchText);

  // Keep the address in step with the filters so a filtered list can be
  // reloaded and shared. replaceState, not a navigation: the page does not
  // re-render on the server, and narrowing a list adds no history entries.
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const next = withTechnologyBrowserQuery(window.location.href, {
      q: deferredSearchText,
      type: typeFilter,
      tag: tagFilter,
      priority: priorityFilter,
      publisher: publisherFilter,
      sort
    });

    if (next !== `${pathname}${search}${hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [
    deferredSearchText,
    typeFilter,
    tagFilter,
    priorityFilter,
    publisherFilter,
    sort
  ]);
  const { readIds, isRead, isSaved, toggleRead, toggleSaved } =
    useReadingState();
  const visitBaselineKeys = useVisitBaseline(
    toVisitKeys(technologies.map((item) => item.id))
  );

  const priorityById = new Map(
    technologies.map((item) => [
      item.id,
      evaluateTechnologyPriority(item).priorityLevel
    ])
  );
  const matchedTechnologies = technologies.filter((item) => {
    const priority = priorityById.get(item.id);
    const matchesSearch =
      deferredSearchText.length === 0 ||
      getTechnologySearchText(item).includes(deferredSearchText.toLowerCase());

    const matchesType = typeFilter.length === 0 || item.type === typeFilter;
    const matchesTag = tagFilter.length === 0 || item.tags.includes(tagFilter);
    const matchesPriority =
      priorityFilter.length === 0 || priority === priorityFilter;
    const matchesPublisher =
      publisherFilter.length === 0 ||
      getPublisherSlug(getSignalPublisherName(item)) === publisherFilter;

    return (
      matchesSearch &&
      matchesType &&
      matchesTag &&
      matchesPriority &&
      matchesPublisher
    );
  });

  const readCount = countReadTechnologies(matchedTechnologies, readIds);
  const filteredTechnologies = sortTechnologiesForBrowser(
    applyReadFilter(matchedTechnologies, readIds, hideRead),
    sort,
    (item) => priorityById.get(item.id) ?? "low_priority"
  );
  const newCount = countNewSinceLastVisit(
    filteredTechnologies,
    visitBaselineKeys,
    readIds
  );
  const shortcuts = useSignalShortcuts({
    signals: filteredTechnologies.map((item) => ({
      id: item.id,
      href: `/technologies/${item.slug}`
    })),
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  });

  const typeOptions = [
    { value: "", label: "全部类型" },
    ...Array.from(new Set(technologies.map((item) => item.type))).map(
      (type) => ({
        value: type,
        label: getTechnologyTypeLabel(type, "zh")
      })
    )
  ];

  const tagOptions = [
    { value: "", label: "全部标签" },
    ...tags.map((tag) => ({ value: tag.id, label: tag.name }))
  ];

  const priorityOptions = [
    { value: "", label: "全部优先级" },
    ...priorityLevelOrder.map((level) => ({
      value: level,
      label: getPriorityLevelLabel(level, "zh")
    }))
  ];

  // About fifty publishers is too many chips for a row of their own, so the
  // publisher filter only arrives by link (a /sources card, a signal page).
  // The row it arrived with stays for the visit: clearing it leaves
  // 全部发布方 lit rather than pulling the row out from under the pointer.
  const linkedPublisher = initialQuery.publisher
    ? technologies.find(
        (item) =>
          getPublisherSlug(getSignalPublisherName(item)) ===
          initialQuery.publisher
      )
    : undefined;
  const publisherOptions = linkedPublisher
    ? [
        { value: "", label: "全部发布方" },
        {
          value: initialQuery.publisher,
          label: getSignalPublisherName(linkedPublisher)
        }
      ]
    : [];

  return (
    <div className="dossier-technology-browser">
      {/* Search, filters, the result count and the read filter are one control
          surface. They used to sit loose on the page background between two
          bordered blocks (the hero and the card grid), which read as a gap in
          the page rather than as a group. */}
      <div className="dossier-technology-browser__controls">
        <DossierSearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="搜索标题、摘要或来源"
          label="搜索技术信号"
        />

        <div className="dossier-technology-browser__filters">
          <DossierCategoryChips
            options={typeOptions}
            active={typeFilter}
            onChange={setTypeFilter}
          />
          <DossierCategoryChips
            options={tagOptions}
            active={tagFilter}
            onChange={setTagFilter}
          />
          <DossierCategoryChips
            options={priorityOptions}
            active={priorityFilter}
            onChange={(value) =>
              setPriorityFilter(
                priorityLevelOrder.find((level) => level === value) ?? ""
              )
            }
          />
          {publisherOptions.length > 0 ? (
            <DossierCategoryChips
              options={publisherOptions}
              active={publisherFilter}
              onChange={setPublisherFilter}
            />
          ) : null}
        </div>

        {/* The read filter lives on this row rather than on one of its own.
            It renders nothing until the reader has marked something, so on its
            own row it appeared out of nowhere and pushed the whole card grid
            down by its height plus its margin. This row is always present, and
            its min-height covers the control, so the switch turns up in place
            and nothing below it moves. */}
        <div className="dossier-technology-browser__toolbar">
          <div className="dossier-technology-browser__count">
            {/* A status, as on /skills and /knowledge: a screen reader hears
                the new count after each keystroke or chip. */}
            <strong role="status">
              {filteredTechnologies.length} 条技术信号
            </strong>
            {newCount > 0 ? (
              <span className="dossier-technology-browser__new-count">
                上次来访后新增 {newCount} 条
              </span>
            ) : null}
          </div>
          <div className="dossier-technology-browser__toolbar-controls">
            <div
              className="dossier-technology-browser__sort"
              role="group"
              aria-labelledby="technology-browser-sort-label"
            >
              <span
                id="technology-browser-sort-label"
                className="dossier-technology-browser__sort-label"
              >
                排序
              </span>
              <DossierCategoryChips
                options={sortOptions}
                active={sort}
                onChange={(value) =>
                  setSort(value === "priority" ? "priority" : "latest")
                }
              />
            </div>
            <ReadFilterToggle
              readCount={readCount}
              hideRead={hideRead}
              onToggle={() => setHideRead((current) => !current)}
            />
            <TechnologyLanguageSwitch mode={mode} onChange={setMode} />
            <SignalShortcutHint onOpen={shortcuts.openHelp} />
          </div>
        </div>
      </div>

      <div className="dossier-technology-list">
        {filteredTechnologies.map((item) => (
          <DossierTechnologyCard
            key={item.id}
            technology={item}
            mode={mode}
            isRead={isRead(item.id)}
            isNew={isNewSinceLastVisit(visitBaselineKeys, item.id, readIds)}
            isCurrent={shortcuts.currentId === item.id}
            readingActions={
              <SignalReadingActions
                isRead={isRead(item.id)}
                isSaved={isSaved(item.id)}
                onToggleRead={() => toggleRead(item.id)}
                onToggleSaved={() => toggleSaved(item.id)}
              />
            }
            tags={item.tags
              .map((tagId) => tags.find((tag) => tag.id === tagId))
              .filter((tag): tag is TopicTag => Boolean(tag))}
          />
        ))}
      </div>

      {filteredTechnologies.length === 0 ? (
        <div className="dossier-empty-state">
          {hideRead && matchedTechnologies.length > 0 ? (
            <>
              <strong>这一批信号你都读过了。</strong>
              <p>关掉「隐藏已读」可以重新看到它们。</p>
            </>
          ) : (
            <>
              <strong>暂无技术信号。</strong>
              <p>试着清除筛选条件，查看已发布的信号。</p>
            </>
          )}
        </div>
      ) : null}

      <SignalShortcutHelp
        open={shortcuts.isHelpOpen}
        onClose={shortcuts.closeHelp}
        announcement={shortcuts.announcement}
      />
    </div>
  );
}
