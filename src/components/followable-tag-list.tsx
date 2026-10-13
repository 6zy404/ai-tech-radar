"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  followedTagsChangedEventName,
  readFollowedTagIds,
  toggleFollowedTagId
} from "@/lib/followed-tags";
import { commonCopy } from "@/lib/i18n/copy/common";
import { localePath } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";
import type { TopicTag } from "@/types/content";

interface FollowableTagListProps {
  tags: TopicTag[];
}

// Follow-topic entry for detail pages (P4): renders the item's tags as the
// same follow/unfollow toggle chips used on /radar, backed by the same
// browser-localStorage follow state. Follows stay client-side only.
export function FollowableTagList({ tags }: FollowableTagListProps) {
  const locale = useLocale();
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

  const copy = commonCopy[locale].followTags;
  const followedTagSet = new Set(followedTagIds);
  const followedCount = tags.filter((tag) => followedTagSet.has(tag.id)).length;

  return (
    <div className="followable-tag-list">
      <div
        className="my-radar__tag-list"
        role="group"
        aria-label={copy.groupLabel}
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
                href={localePath(locale, `/topics/${tag.id}`)}
                className="followable-tag-list__topic-link"
                title={copy.topicLinkTitle(tag.name)}
              >
                {copy.topicLink}
              </Link>
            </span>
          );
        })}
      </div>
      {isLoaded ? (
        followedCount > 0 ? (
          <p className="followable-tag-list__hint">
            {copy.followed}
            <Link
              className="action-link"
              href={localePath(locale, "/technologies?view=followed")}
            >
              {copy.view}
            </Link>
          </p>
        ) : (
          <p className="followable-tag-list__hint">
            {copy.hint}
          </p>
        )
      ) : null}
    </div>
  );
}
