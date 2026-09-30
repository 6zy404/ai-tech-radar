"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  followedTagsChangedEventName,
  readFollowedTagIds,
  setTagFollowed
} from "@/lib/followed-tags";

interface TopicFollowToggleProps {
  tagId: string;
  tagName: string;
}

// The topic hub's follow control (P4): the same browser-localStorage follow
// state as the detail pages' tag chips and the 我关注的 view, for one topic.
// The server renders the not-followed state for everyone; the stored state is
// read after mount. Both hint lines are always rendered in one grid cell with
// only one visible, so the cell is as tall as the longer one before and after
// the swap and nothing below it moves. Divs, not <p>: `.user-shell p` pins
// every paragraph to body size with !important.
export function TopicFollowToggle({ tagId, tagName }: TopicFollowToggleProps) {
  const [isFollowed, setIsFollowed] = useState(false);

  useEffect(() => {
    const syncFromStorage = () =>
      setIsFollowed(readFollowedTagIds().includes(tagId));

    syncFromStorage();
    window.addEventListener(followedTagsChangedEventName, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(followedTagsChangedEventName, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [tagId]);

  return (
    <div className="topic-follow-toggle">
      <button
        type="button"
        className={`my-radar__tag-toggle${
          isFollowed ? " my-radar__tag-toggle--active" : ""
        }`}
        aria-pressed={isFollowed}
        onClick={() =>
          setIsFollowed(setTagFollowed(tagId, !isFollowed).includes(tagId))
        }
      >
        {isFollowed ? "✓ " : "+ "}关注此话题
      </button>
      <div className="topic-follow-toggle__hints">
        <div
          className="topic-follow-toggle__hint"
          data-visible={isFollowed ? undefined : "true"}
        >
          {`关注后，「${tagName}」的新信号会汇总到「我关注的」，简报里也会标出。只记在这个浏览器里，无需账号。`}
        </div>
        <div
          className="topic-follow-toggle__hint"
          data-visible={isFollowed ? "true" : undefined}
        >
          {`已加入我的雷达，「${tagName}」的新信号会汇总到「我关注的」，简报里也会标出 · `}
          <Link className="action-link" href="/technologies?view=followed">
            查看
          </Link>
        </div>
      </div>
    </div>
  );
}
