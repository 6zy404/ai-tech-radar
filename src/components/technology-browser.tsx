"use client";

import { useDeferredValue, useState } from "react";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierSearchInput } from "@/components/dossier-search-input";
import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { ReadFilterToggle } from "@/components/read-filter-toggle";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { useReadingState } from "@/components/use-reading-state";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { applyReadFilter, countReadTechnologies } from "@/lib/reading-state";
import {
  getTechnologySearchText,
  getTechnologyTypeLabel,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type { PriorityLevel, TechnologyItem, TopicTag } from "@/types/content";

interface TechnologyBrowserProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

const priorityLevels: PriorityLevel[] = [
  "high_priority",
  "watch",
  "low_priority"
];

export function TechnologyBrowser({
  technologies,
  tags
}: TechnologyBrowserProps) {
  const [mode, setMode] = useState<TechnologyContentMode>("zh");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [hideRead, setHideRead] = useState(false);
  const deferredSearchText = useDeferredValue(searchText);
  const { readIds, isRead, isSaved, toggleRead, toggleSaved } =
    useReadingState();

  const matchedTechnologies = technologies.filter((item) => {
    const priority = evaluateTechnologyPriority(item).priorityLevel;
    const matchesSearch =
      deferredSearchText.length === 0 ||
      getTechnologySearchText(item).includes(deferredSearchText.toLowerCase());

    const matchesType = typeFilter.length === 0 || item.type === typeFilter;
    const matchesTag = tagFilter.length === 0 || item.tags.includes(tagFilter);
    const matchesPriority =
      priorityFilter.length === 0 || priority === priorityFilter;

    return matchesSearch && matchesType && matchesTag && matchesPriority;
  });

  const readCount = countReadTechnologies(matchedTechnologies, readIds);
  const filteredTechnologies = applyReadFilter(
    matchedTechnologies,
    readIds,
    hideRead
  );

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
    ...priorityLevels.map((level) => ({
      value: level,
      label: getPriorityLevelLabel(level, "zh")
    }))
  ];

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
            onChange={setPriorityFilter}
          />
        </div>

        {/* The read filter lives on this row rather than on one of its own.
            It renders nothing until the reader has marked something, so on its
            own row it appeared out of nowhere and pushed the whole card grid
            down by its height plus its margin. This row is always present, and
            its min-height covers the control, so the switch turns up in place
            and nothing below it moves. */}
        <div className="dossier-technology-browser__toolbar">
          <strong>{filteredTechnologies.length} 条技术信号</strong>
          <div className="dossier-technology-browser__toolbar-controls">
            <ReadFilterToggle
              readCount={readCount}
              hideRead={hideRead}
              onToggle={() => setHideRead((current) => !current)}
            />
            <TechnologyLanguageSwitch mode={mode} onChange={setMode} />
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
    </div>
  );
}
