"use client";

import { HomeSignalCard } from "@/components/home-signal-card";
import { LocalRecommendHeading } from "@/components/local-recommend-heading";
import { useLocalRecommendations } from "@/components/use-local-recommendations";
import { useReadingState } from "@/components/use-reading-state";
import { describeRecommendationReason } from "@/lib/local-recommend";
import type { TopicTag } from "@/types/content";

const homeRecommendLimit = 3;

/**
 * 和你读过的相近 on the home page. The cards come from the recommendation
 * data file, so the page itself carries nothing for it but the topic names.
 * Renders nothing until the browser has computed at least one
 * recommendation — no placeholder, no reserved space — and sits below
 * 现在最值得关注, so it is never above what the reader is looking at when it
 * appears.
 */
export function HomeRecommendSection({ tags }: { tags: TopicTag[] }) {
  const { readIds, savedIds, isLoaded } = useReadingState();
  const recommendations = useLocalRecommendations({
    readIds,
    savedIds,
    isLoaded,
    limit: homeRecommendLimit
  });

  if (recommendations.length === 0) {
    return null;
  }

  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  return (
    <section className="section-block local-recommend">
      <LocalRecommendHeading />
      <div className="home-signal-grid">
        {recommendations.map(({ card, seed, seedMark, matchedTagIds }) => (
          <HomeSignalCard
            key={card.slug}
            href={`/technologies/${card.slug}`}
            title={card.title}
            summary={card.summary}
            priorityLabel={card.priorityLabel}
            publishDate={card.publishDate}
            noteLabel="为什么推荐"
            note={describeRecommendationReason({
              seedTitle: seed.title,
              seedMark,
              matchedTagNames: matchedTagIds.flatMap(
                (tagId) => tagById.get(tagId)?.name ?? []
              )
            })}
            tags={card.tagIds.flatMap((tagId) => tagById.get(tagId) ?? [])}
          />
        ))}
      </div>
    </section>
  );
}
