"use client";

import Link from "next/link";
import { useState } from "react";

import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { ReadFilterToggle } from "@/components/read-filter-toggle";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import { useReadingState } from "@/components/use-reading-state";
import {
  applyReadFilter,
  countReadTechnologies,
  selectSavedTechnologies
} from "@/lib/reading-state";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface SavedSignalsContentProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

/**
 * The 稍后读 view on /technologies. Like the 我关注的 view, the served
 * content is identical for everyone — the reading marks live only in the
 * reader's browser, so this component resolves them client-side.
 */
export function SavedSignalsContent({
  technologies,
  tags
}: SavedSignalsContentProps) {
  const [hideRead, setHideRead] = useState(false);
  const {
    savedIds,
    readIds,
    isLoaded,
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  } = useReadingState();

  const savedTechnologies = selectSavedTechnologies(technologies, savedIds);
  const readCount = countReadTechnologies(savedTechnologies, readIds);
  const shownTechnologies = applyReadFilter(
    savedTechnologies,
    readIds,
    hideRead
  );

  if (!isLoaded) {
    return (
      <div className="saved-signals">
        <p className="saved-signals__lede">正在读取本地的稍后读列表…</p>
      </div>
    );
  }

  if (savedTechnologies.length === 0) {
    return (
      <div className="saved-signals">
        <div className="dossier-empty-state">
          <strong>你的稍后读还是空的。</strong>
          <p>
            在<Link href="/technologies">「精选」</Link>
            里看到想回头细读的信号，点一下「稍后读」，它就会攒到这里。
            标记只保存在这台设备的浏览器里。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-signals">
      {/* Same reason as the curated view's toolbar: the read filter shares an
          always-present row instead of owning one, so marking the first signal
          read does not push the list down. */}
      <div className="saved-signals__toolbar">
        <p className="saved-signals__lede">
          已攒下 {savedTechnologies.length} 条信号，最近保存的排在前面。
        </p>

        <ReadFilterToggle
          readCount={readCount}
          hideRead={hideRead}
          onToggle={() => setHideRead((current) => !current)}
        />
      </div>

      <div className="dossier-technology-list">
        {shownTechnologies.map((item) => (
          <DossierTechnologyCard
            key={item.id}
            technology={item}
            mode="zh"
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

      {shownTechnologies.length === 0 ? (
        <div className="dossier-empty-state">
          <strong>攒下的信号你都读完了。</strong>
          <p>关掉「隐藏已读」可以回看，或者取消「稍后读」把它们清出列表。</p>
        </div>
      ) : null}
    </div>
  );
}
