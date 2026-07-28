"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import { useReadingState } from "@/components/use-reading-state";
import { topicFeedPath } from "@/lib/feed-paths";
import {
  followedTagsChangedEventName,
  readFollowedTagIds,
  toggleFollowedTagId,
  writeFollowedTagIds
} from "@/lib/followed-tags";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import type { PriorityLevel, TechnologyItem, TopicTag } from "@/types/content";

interface MyRadarContentProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

const priorityGroups: { level: PriorityLevel; title: string; lede: string }[] =
  [
    {
      level: "high_priority",
      title: getPriorityLevelLabel("high_priority", "zh"),
      lede: "命中你关注话题、且多项信号显示值得尽早评估的内容。"
    },
    {
      level: "watch",
      title: getPriorityLevelLabel("watch", "zh"),
      lede: "命中你关注话题、值得持续留意的变化。"
    },
    {
      level: "low_priority",
      title: getPriorityLevelLabel("low_priority", "zh"),
      lede: "命中你关注话题的背景型内容，空闲时浏览。"
    }
  ];

export function MyRadarContent({ technologies, tags }: MyRadarContentProps) {
  const [followedTagIds, setFollowedTagIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const readingState = useReadingState();

  const handleExportFollows = async () => {
    const code = followedTagIds.join(",");

    if (!code) {
      setTransferMessage("还没有关注任何话题，无可导出。");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setTransferMessage(
        "关注码已复制，在另一台设备上点「导入关注」粘贴即可。"
      );
    } catch {
      window.prompt("复制这段关注码，在另一台设备上导入：", code);
      setTransferMessage("");
    }
  };

  const handleImportFollows = () => {
    const raw = window.prompt("粘贴另一台设备导出的关注码：");

    if (raw === null) {
      return;
    }

    const knownTagIds = new Set(tags.map((tag) => tag.id));
    const importedIds = raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => knownTagIds.has(item));

    if (importedIds.length === 0) {
      setTransferMessage("关注码无效：没有识别出任何话题。");
      return;
    }

    const merged = [...new Set([...followedTagIds, ...importedIds])];

    writeFollowedTagIds(merged);
    setFollowedTagIds(merged);
    setTransferMessage(`已导入 ${importedIds.length} 个话题的关注。`);
  };

  useEffect(() => {
    const syncFromStorage = () => setFollowedTagIds(readFollowedTagIds());

    syncFromStorage();
    setIsLoaded(true);
    window.addEventListener(followedTagsChangedEventName, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(followedTagsChangedEventName, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const followedTagSet = new Set(followedTagIds);
  const matchedTechnologies = technologies
    .map((technology) => ({
      technology,
      matchedTags: tags.filter(
        (tag) => followedTagSet.has(tag.id) && technology.tags.includes(tag.id)
      )
    }))
    .filter((item) => item.matchedTags.length > 0);

  const groupedTechnologies = priorityGroups
    .map((group) => ({
      ...group,
      items: matchedTechnologies
        .filter(
          (item) =>
            evaluateTechnologyPriority(item.technology).priorityLevel ===
            group.level
        )
        .sort((left, right) =>
          right.technology.publishDate.localeCompare(
            left.technology.publishDate
          )
        )
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="my-radar">
      <section className="my-radar__manager">
        <div className="my-radar__manager-copy">
          <p className="eyebrow user-eyebrow">关注话题</p>
          <h2>选择你想跟踪的话题</h2>
          <p>
            关注状态只保存在当前浏览器中，不需要账号。点击话题即可关注或取消。
          </p>
        </div>
        <div
          className="my-radar__tag-list"
          role="group"
          aria-label="关注话题开关"
        >
          {tags.map((tag) => {
            const isFollowed = followedTagSet.has(tag.id);

            return (
              <button
                key={tag.id}
                type="button"
                className={`my-radar__tag-toggle${
                  isFollowed ? " my-radar__tag-toggle--active" : ""
                }`}
                aria-pressed={isFollowed}
                title={tag.description}
                onClick={() => setFollowedTagIds(toggleFollowedTagId(tag.id))}
              >
                {isFollowed ? "✓ " : "+ "}
                {tag.name}
              </button>
            );
          })}
        </div>
        <div className="my-radar__transfer">
          <button type="button" onClick={handleExportFollows}>
            导出关注
          </button>
          <button type="button" onClick={handleImportFollows}>
            导入关注
          </button>
          {transferMessage ? <span>{transferMessage}</span> : null}
        </div>
      </section>

      {isLoaded && followedTagIds.length > 0 ? (
        <section className="my-radar__feeds">
          <p className="my-radar__feeds-lede">
            话题订阅源：把链接加进任何 RSS
            阅读器，新发布的信号会自动送达，换设备也不丢。
          </p>
          <div className="digest-feed-links">
            {tags
              .filter(
                (tag) =>
                  followedTagSet.has(tag.id) &&
                  technologies.some((technology) =>
                    technology.tags.includes(tag.id)
                  )
              )
              .map((tag) => (
                <Link key={tag.id} href={topicFeedPath(tag.id)}>
                  {tag.name} RSS
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      {isLoaded && followedTagIds.length === 0 ? (
        <section className="empty-state empty-state--actionable">
          <strong>还没有关注任何话题。</strong>
          <p>
            在上方选择几个感兴趣的话题，你的雷达就会按优先级聚合命中这些话题的已发布技术信号。
          </p>
        </section>
      ) : null}

      {isLoaded &&
      followedTagIds.length > 0 &&
      matchedTechnologies.length === 0 ? (
        <section className="empty-state empty-state--actionable">
          <strong>你关注的话题暂时没有命中的已发布信号。</strong>
          <p>
            可以再关注几个相邻话题，或先到
            <Link className="action-link" href="/technologies">
              技术信号流
            </Link>
            看看全部已发布内容。
          </p>
        </section>
      ) : null}

      {groupedTechnologies.map((group) => (
        <section key={group.level} className="my-radar__group">
          <div className="my-radar__group-header">
            <h2>{group.title}</h2>
            <p>{group.lede}</p>
          </div>
          <div className="dossier-technology-list">
            {group.items.map(({ technology, matchedTags }) => (
              <div key={technology.id} className="my-radar__item">
                <p className="my-radar__match-line">
                  命中关注：{matchedTags.map((tag) => tag.name).join("、")}
                </p>
                <DossierTechnologyCard
                  technology={technology}
                  mode="zh"
                  isRead={readingState.isRead(technology.id)}
                  readingActions={
                    <SignalReadingActions
                      isRead={readingState.isRead(technology.id)}
                      isSaved={readingState.isSaved(technology.id)}
                      onToggleRead={() =>
                        readingState.toggleRead(technology.id)
                      }
                      onToggleSaved={() =>
                        readingState.toggleSaved(technology.id)
                      }
                    />
                  }
                  tags={technology.tags
                    .map((tagId) => tags.find((tag) => tag.id === tagId))
                    .filter((tag): tag is TopicTag => Boolean(tag))}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
