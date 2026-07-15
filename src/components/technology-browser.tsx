"use client";

import { useDeferredValue, useState } from "react";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierSearchInput } from "@/components/dossier-search-input";
import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import {
  getTechnologySearchText,
  getTechnologySwitchLabel,
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

      <div className="dossier-technology-browser__toolbar">
        <div>
          <strong>{filteredTechnologies.length} 条技术信号</strong>
          <p>
            仅展示已发布信号。当理由、关注人群和来源符合你接下来想了解的内容时，
            再打开对应条目。
          </p>
        </div>
        <TechnologyLanguageSwitch
          mode={mode}
          onChange={setMode}
          label={getTechnologySwitchLabel("list")}
          compact
        />
      </div>

      <div className="dossier-technology-list">
        {filteredTechnologies.map((item) => (
          <DossierTechnologyCard
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
        <div className="dossier-empty-state">
          <strong>暂无技术信号。</strong>
          <p>试着清除筛选条件，查看已发布的信号。</p>
        </div>
      ) : null}
    </div>
  );
}
