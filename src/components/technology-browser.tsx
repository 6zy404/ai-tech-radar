"use client";

import { useDeferredValue, useState } from "react";

import { SearchFilterBar } from "@/components/search-filter-bar";
import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { TechnologyListCard } from "@/components/technology-list-card";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import {
  getTechnologySearchText,
  getTechnologySwitchLabel,
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
  const deferredSearchText = useDeferredValue(searchText);

  const filteredTechnologies = technologies.filter((item) => {
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

  const typeOptions = [
    { value: "", label: "All types" },
    ...Array.from(new Set(technologies.map((item) => item.type))).map((type) => ({
      value: type,
      label: type
    }))
  ];

  const tagOptions = [
    { value: "", label: "All tags" },
    ...tags.map((tag) => ({ value: tag.id, label: tag.name }))
  ];

  const priorityOptions = [
    { value: "", label: "All priorities" },
    ...priorityLevels.map((level) => ({
      value: level,
      label: getPriorityLevelLabel(level, "zh")
    }))
  ];

  return (
    <>
      <SearchFilterBar
        searchValue={searchText}
        onSearchChange={setSearchText}
        typeValue={typeFilter}
        onTypeChange={setTypeFilter}
        tagValue={tagFilter}
        onTagChange={setTagFilter}
        priorityValue={priorityFilter}
        onPriorityChange={setPriorityFilter}
        typeOptions={typeOptions}
        tagOptions={tagOptions}
        priorityOptions={priorityOptions}
        labels={{
          search: "Search",
          searchPlaceholder: "Search title, summary, or source",
          type: "Type",
          tag: "Tag",
          priority: "Priority"
        }}
      />

      <div className="technology-browser__toolbar user-list-toolbar">
        <div>
          <strong>{filteredTechnologies.length} technology signals</strong>
          <p>
            Published signals only. Open the item when the reason, audience, and
            source match what you need to understand next.
          </p>
        </div>
        <TechnologyLanguageSwitch
          mode={mode}
          onChange={setMode}
          label={getTechnologySwitchLabel("list")}
          compact
        />
      </div>

      <div className="technology-signal-list">
        {filteredTechnologies.map((item) => (
          <TechnologyListCard
            key={item.id}
            technology={item}
            mode={mode}
            tags={item.tags
              .map((tagId) => tags.find((tag) => tag.id === tagId))
              .filter((tag): tag is TopicTag => Boolean(tag))}
          />
        ))}
      </div>

      {filteredTechnologies.length === 0 ? (
        <div className="empty-state empty-state--actionable">
          <strong>No technology signals yet.</strong>
          <p>Try clearing the filters to see published signals.</p>
        </div>
      ) : null}
    </>
  );
}
