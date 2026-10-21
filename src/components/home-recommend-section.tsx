"use client";

import { HomeSignalCard } from "@/components/home-signal-card";
import { LocalRecommendHeading } from "@/components/local-recommend-heading";
import { useLocalRecommendations } from "@/components/use-local-recommendations";
import { useReadingState } from "@/components/use-reading-state";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath } from "@/lib/i18n/locale";
import { contentLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";
import { describeRecommendationReason } from "@/lib/local-recommend";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import type { PriorityLevel } from "@/types/content";
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
const priorityLevels: PriorityLevel[] = [
  "high_priority",
  "watch",
  "low_priority"
];

export function HomeRecommendSection({ tags }: { tags: TopicTag[] }) {
  const locale = useLocale();
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
  // The data file is the same for everyone and in Chinese: its titles and
  // gists stay Chinese on the English site (marked), and its band label is
  // put back into the interface language.
  const englishBand = new Map(
    priorityLevels.map((level) => [
      getPriorityLevelLabel(level, "zh"),
      getPriorityLevelLabel(level, "zh", locale)
    ])
  );
  const fileLang = contentLangAttr(locale);

  return (
    <section className="section-block local-recommend">
      <LocalRecommendHeading locale={locale} />
      <div className="home-signal-grid">
        {recommendations.map(({ card, seed, seedMark, matchedTagIds }) => (
          <HomeSignalCard
            key={card.slug}
            locale={locale}
            href={localePath(locale, `/technologies/${card.slug}`)}
            title={card.title}
            summary={card.summary}
            titleLang={fileLang}
            summaryLang={fileLang}
            priorityLabel={
              englishBand.get(card.priorityLabel) ?? card.priorityLabel
            }
            publishDate={card.publishDate}
            noteLabel={signalsCopy[locale].recommend.noteLabel}
            note={describeRecommendationReason({
              seedTitle: seed.title,
              seedMark,
              locale,
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
