"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  followedTagsChangedEventName,
  readFollowedTagIds,
  setTagFollowed
} from "@/lib/followed-tags";
import { topicsCopy } from "@/lib/i18n/copy/topics";
import { localePath } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";

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
  const locale = useLocale();
  const copy = topicsCopy[locale].followToggle;
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
        <span aria-hidden="true">{isFollowed ? "✓ " : "+ "}</span>
        {copy.follow}
      </button>
      <div className="topic-follow-toggle__hints">
        <div
          className="topic-follow-toggle__hint"
          data-visible={isFollowed ? undefined : "true"}
        >
          {copy.hintOff(tagName)}
        </div>
        <div
          className="topic-follow-toggle__hint"
          data-visible={isFollowed ? "true" : undefined}
        >
          {copy.hintOn(tagName)}
          <Link
            className="action-link"
            href={localePath(locale, "/technologies?view=followed")}
          >
            {copy.view}
          </Link>
        </div>
      </div>
    </div>
  );
}
