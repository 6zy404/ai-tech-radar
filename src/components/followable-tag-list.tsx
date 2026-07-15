"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  followedTagsChangedEventName,
  readFollowedTagIds,
  toggleFollowedTagId
} from "@/lib/followed-tags";
import type { TopicTag } from "@/types/content";

interface FollowableTagListProps {
  tags: TopicTag[];
}

// Follow-topic entry for detail pages (P4): renders the item's tags as the
// same follow/unfollow toggle chips used on /radar, backed by the same
// browser-localStorage follow state. Follows stay client-side only.
export function FollowableTagList({ tags }: FollowableTagListProps) {
  const [followedTagIds, setFollowedTagIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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

  if (tags.length === 0) {
    return null;
  }

  const followedTagSet = new Set(followedTagIds);
  const followedCount = tags.filter((tag) => followedTagSet.has(tag.id)).length;

  return (
    <div className="followable-tag-list">
      <div
        className="my-radar__tag-list"
        role="group"
        aria-label="关注本页话题开关"
      >
        {tags.map((tag) => {
          const isFollowed = followedTagSet.has(tag.id);

          return (
            <span key={tag.id} className="followable-tag-list__item">
              <button
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
              <Link
                href={`/topics/${tag.id}`}
                className="followable-tag-list__topic-link"
                title={`查看「${tag.name}」专题`}
              >
                查看专题
              </Link>
            </span>
          );
        })}
      </div>
      {isLoaded ? (
        followedCount > 0 ? (
          <p className="followable-tag-list__hint">
            已加入我的雷达 ·{" "}
            <Link className="action-link" href="/technologies?view=followed">
              查看
            </Link>
          </p>
        ) : (
          <p className="followable-tag-list__hint">
            点击话题，将它加入我的雷达。
          </p>
        )
      ) : null}
    </div>
  );
}
