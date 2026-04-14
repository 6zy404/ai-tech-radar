"use client";

import { useDeferredValue, useState } from "react";

import { ContentCard } from "@/components/content-card";
import { SearchFilterBar } from "@/components/search-filter-bar";
import { TagBadge } from "@/components/tag-badge";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface TechnologyBrowserProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

export function TechnologyBrowser({
  technologies,
  tags
}: TechnologyBrowserProps) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  const filteredTechnologies = technologies.filter((item) => {
    const matchesSearch =
      deferredSearchText.length === 0 ||
      item.title.toLowerCase().includes(deferredSearchText.toLowerCase()) ||
      item.summary.toLowerCase().includes(deferredSearchText.toLowerCase());

    const matchesType = typeFilter.length === 0 || item.type === typeFilter;
    const matchesTag = tagFilter.length === 0 || item.tags.includes(tagFilter);

    return matchesSearch && matchesType && matchesTag;
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
      />

      <div className="section-heading">
        <p>{filteredTechnologies.length} items</p>
      </div>

      <div className="content-grid">
        {filteredTechnologies.map((item) => (
          <ContentCard
            key={item.id}
            title={item.title}
            summary={item.summary}
            href={`/technologies/${item.slug}`}
            meta={[item.type, item.importanceLevel, item.publishDate]}
            badges={
              <>
                {item.tags
                  .map((tagId) => tags.find((tag) => tag.id === tagId))
                  .filter((tag): tag is TopicTag => Boolean(tag))
                  .map((tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
              </>
            }
          />
        ))}
      </div>

      {filteredTechnologies.length === 0 ? (
        <p className="empty-state">
          No technology items matched the current search and filters.
        </p>
      ) : null}
    </>
  );
}
