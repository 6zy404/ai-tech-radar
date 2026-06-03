"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { SearchFilterBar } from "@/components/search-filter-bar";
import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { TechnologyListCard } from "@/components/technology-list-card";
import {
  getTechnologySearchText,
  getTechnologySwitchLabel,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface TechnologyBrowserProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

export function TechnologyBrowser({
  technologies,
  tags
}: TechnologyBrowserProps) {
  const [mode, setMode] = useState<TechnologyContentMode>("zh");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  const filteredTechnologies = technologies.filter((item) => {
    const matchesSearch =
      deferredSearchText.length === 0 ||
      getTechnologySearchText(item).includes(deferredSearchText.toLowerCase());

    const matchesType = typeFilter.length === 0 || item.type === typeFilter;
    const matchesTag = tagFilter.length === 0 || item.tags.includes(tagFilter);

    return matchesSearch && matchesType && matchesTag;
  });

  const typeOptions = [
    { value: "", label: "全部类型" },
    ...Array.from(new Set(technologies.map((item) => item.type))).map((type) => ({
      value: type,
      label: type
    }))
  ];

  const tagOptions = [
    { value: "", label: "全部标签" },
    ...tags.map((tag) => ({ value: tag.id, label: tag.name }))
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
        typeOptions={typeOptions}
        tagOptions={tagOptions}
        labels={{
          search: "搜索",
          searchPlaceholder: "搜索标题、摘要或来源",
          type: "类型",
          tag: "标签"
        }}
      />

      <div className="technology-browser__toolbar user-list-toolbar">
        <div>
          <strong>{filteredTechnologies.length} 条技术信号</strong>
          <p>按优先级、适合人群和学习路径快速判断先读哪一条。</p>
        </div>
        <TechnologyLanguageSwitch
          mode={mode}
          onChange={setMode}
          label={getTechnologySwitchLabel("list")}
          compact
        />
      </div>

      <div className="content-grid technology-grid">
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
          <strong>没有匹配的已发布技术信号。</strong>
          <p>清空搜索条件，或从最新每日技术简报开始阅读。</p>
          <Link href="/digest/today" className="action-link">
            阅读最新简报
          </Link>
        </div>
      ) : null}
    </>
  );
}
