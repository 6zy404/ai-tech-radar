"use client";

import { useState } from "react";

import { TechnologyLanguageSwitch } from "@/components/technology-language-switch";
import { TechnologyListCard } from "@/components/technology-list-card";
import { getTechnologySwitchLabel, type TechnologyContentMode } from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface TechnologyHomeSectionsProps {
  featuredTechnologies: TechnologyItem[];
  recentTechnologies: TechnologyItem[];
  tags: TopicTag[];
}

export function TechnologyHomeSections({
  featuredTechnologies,
  recentTechnologies,
  tags
}: TechnologyHomeSectionsProps) {
  const [mode, setMode] = useState<TechnologyContentMode>("zh");

  return (
    <>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Today First</h2>
            <p>Editorially chosen published items, not ranked output.</p>
          </div>
          <TechnologyLanguageSwitch
            mode={mode}
            onChange={setMode}
            label={getTechnologySwitchLabel("home")}
            compact
          />
        </div>
        <div className="content-grid technology-grid">
          {featuredTechnologies.map((item) => (
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
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>New Technology Feed</h2>
          <p>Recent published items that connect new signals with useful skills and knowledge.</p>
        </div>
        <div className="content-grid technology-grid">
          {recentTechnologies.map((item) => (
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
      </section>
    </>
  );
}
