"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { PushAlertToggle } from "@/components/push-alert-toggle";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import {
  SignalShortcutHelp,
  SignalShortcutHint
} from "@/components/signal-shortcut-help";
import { useReadingState } from "@/components/use-reading-state";
import { useSignalShortcuts } from "@/components/use-signal-shortcuts";
import { useVisitBaseline } from "@/components/visit-baseline";
import { topicFeedPath } from "@/lib/feed-paths";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";
import {
  followedTagsChangedEventName,
  readFollowedTagIds,
  toggleFollowedTagId,
  writeFollowedTagIds
} from "@/lib/followed-tags";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { isNewSinceLastVisit, toVisitKeys } from "@/lib/visit-state";
import type { PriorityLevel, TechnologyItem, TopicTag } from "@/types/content";

interface MyRadarContentProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

const priorityGroupLevels: PriorityLevel[] = [
  "high_priority",
  "watch",
  "low_priority"
];

export function MyRadarContent({ technologies, tags }: MyRadarContentProps) {
  const locale = useLocale();
  const copy = signalsCopy[locale].myRadar;
  const priorityGroups = priorityGroupLevels.map((level) => ({
    level,
    title: getPriorityLevelLabel(level, "zh", locale),
    lede: copy.groupLedes[level]
  }));
  const [followedTagIds, setFollowedTagIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const readingState = useReadingState();
  // Recorded here as well as on 精选: this view also receives the whole
  // published list, and a reader may open it directly.
  const visitBaselineKeys = useVisitBaseline(
    toVisitKeys(technologies.map((technology) => technology.id))
  );

  const handleExportFollows = async () => {
    const code = followedTagIds.join(",");

    if (!code) {
      setTransferMessage(copy.nothingToExport);
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setTransferMessage(copy.exported);
    } catch {
      window.prompt(copy.copyPrompt, code);
      setTransferMessage("");
    }
  };

  const handleImportFollows = () => {
    const raw = window.prompt(copy.pastePrompt);

    if (raw === null) {
      return;
    }

    const knownTagIds = new Set(tags.map((tag) => tag.id));
    const importedIds = raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => knownTagIds.has(item));

    if (importedIds.length === 0) {
      setTransferMessage(copy.invalidCode);
      return;
    }

    const merged = [...new Set([...followedTagIds, ...importedIds])];

    writeFollowedTagIds(merged);
    setFollowedTagIds(merged);
    setTransferMessage(copy.imported(importedIds.length));
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
  // j / k walk the cards in reading order: group by group, top to bottom.
  const shortcuts = useSignalShortcuts({
    signals: groupedTechnologies.flatMap((group) =>
      group.items.map(({ technology }) => ({
        id: technology.id,
        href: localePath(locale, `/technologies/${technology.slug}`)
      }))
    ),
    isRead: readingState.isRead,
    isSaved: readingState.isSaved,
    toggleRead: readingState.toggleRead,
    toggleSaved: readingState.toggleSaved
  });

  return (
    <div className="my-radar">
      <section className="my-radar__manager">
        <div className="my-radar__manager-copy">
          <p className="eyebrow user-eyebrow">{copy.eyebrow}</p>
          <h2>{copy.heading}</h2>
          {/* The page description already says follows live only in this
              browser; repeating it here said the same thing twice, in two
              different wordings, a few hundred pixels apart. */}
          <p>{copy.lede}</p>
        </div>
        <div
          className="my-radar__tag-list"
          role="group"
          aria-label={copy.toggleGroupLabel}
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
                <span aria-hidden="true">{isFollowed ? "✓ " : "+ "}</span>
                {tag.name}
              </button>
            );
          })}
        </div>
        <div className="my-radar__transfer">
          <button type="button" onClick={handleExportFollows}>
            {copy.export}
          </button>
          <button type="button" onClick={handleImportFollows}>
            {copy.import}
          </button>
          {transferMessage ? <span>{transferMessage}</span> : null}
        </div>
      </section>

      {isLoaded && followedTagIds.length > 0 ? (
        <section className="my-radar__feeds">
          <p className="my-radar__feeds-lede">{copy.feedsLede}</p>
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
                  {copy.feedLink(tag.name)}
                </Link>
              ))}
          </div>
          <PushAlertToggle followedTagIds={followedTagIds} />
        </section>
      ) : null}

      {isLoaded && followedTagIds.length === 0 ? (
        <section className="empty-state empty-state--actionable">
          <strong>{copy.noFollowsTitle}</strong>
          <p>{copy.noFollowsBody}</p>
        </section>
      ) : null}

      {isLoaded &&
      followedTagIds.length > 0 &&
      matchedTechnologies.length === 0 ? (
        <section className="empty-state empty-state--actionable">
          <strong>{copy.noMatchesTitle}</strong>
          <p>
            {copy.noMatchesBefore}
            <Link
              className="action-link"
              href={localePath(locale, "/technologies")}
            >
              {copy.noMatchesLink}
            </Link>
            {copy.noMatchesAfter}
          </p>
        </section>
      ) : null}

      {groupedTechnologies.map((group, groupIndex) => (
        <section key={group.level} className="my-radar__group">
          <div className="my-radar__group-header">
            {/* The shortcut hint sits beside the first group's title: this
                view has no count row to carry it, and a line of its own
                would push every card down. */}
            {groupIndex === 0 ? (
              <div className="my-radar__group-title-row">
                <h2>{group.title}</h2>
                <SignalShortcutHint onOpen={shortcuts.openHelp} />
              </div>
            ) : (
              <h2>{group.title}</h2>
            )}
            <p>{group.lede}</p>
          </div>
          <div className="dossier-technology-list">
            {group.items.map(({ technology, matchedTags }) => (
              <div key={technology.id} className="my-radar__item">
                <DossierTechnologyCard
                  technology={technology}
                  mode={locale === "en" ? "original" : "zh"}
                  locale={locale}
                  matchLine={
                    <p className="my-radar__match-line">
                      {copy.matchLine(matchedTags.map((tag) => tag.name))}
                    </p>
                  }
                  isRead={readingState.isRead(technology.id)}
                  isNew={isNewSinceLastVisit(
                    visitBaselineKeys,
                    technology.id,
                    readingState.readIds
                  )}
                  isCurrent={shortcuts.currentId === technology.id}
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

      <SignalShortcutHelp
        open={shortcuts.isHelpOpen}
        onClose={shortcuts.closeHelp}
        announcement={shortcuts.announcement}
      />
    </div>
  );
}
