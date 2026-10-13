"use client";

import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { LocalRecommendHeading } from "@/components/local-recommend-heading";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import { useLocalRecommendations } from "@/components/use-local-recommendations";
import type { ReadingState } from "@/components/use-reading-state";
import { useLocale } from "@/lib/i18n/use-locale";
import { describeRecommendationReason } from "@/lib/local-recommend";
import { getTechnologyTitleForLocale } from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

const savedRecommendLimit = 4;

/**
 * 和你读过的相近 at the foot of the 稍后读 view: the same cards as the list
 * above, each carrying its reason where the 我关注的 view puts 命中关注.
 * Takes the view's own reading state, so saving a recommendation moves it
 * into the list above in the same render.
 */
export function SavedRecommendations({
  technologies,
  tags,
  readingState
}: {
  technologies: TechnologyItem[];
  tags: TopicTag[];
  readingState: ReadingState;
}) {
  const locale = useLocale();
  const recommendations = useLocalRecommendations({
    readIds: readingState.readIds,
    savedIds: readingState.savedIds,
    isLoaded: readingState.isLoaded,
    limit: savedRecommendLimit
  });

  if (recommendations.length === 0) {
    return null;
  }

  // The file names signals by slug; the view already holds every published
  // signal, so a card renders from the full record like the list above.
  const bySlug = new Map(technologies.map((item) => [item.slug, item]));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  return (
    <section className="local-recommend local-recommend--saved">
      <LocalRecommendHeading locale={locale} />
      <div className="dossier-technology-list">
        {recommendations.map((recommendation) => {
          const item = bySlug.get(recommendation.card.slug);

          if (!item) {
            return null;
          }

          return (
            <DossierTechnologyCard
              key={item.id}
              technology={item}
              mode={locale === "en" ? "original" : "zh"}
              locale={locale}
              matchLine={
                <p className="my-radar__match-line">
                  {describeRecommendationReason({
                    // The file carries the Chinese title; the view holds the
                    // full record, so the English site names it in English.
                    seedTitle:
                      locale === "zh"
                        ? recommendation.seed.title
                        : (() => {
                            const seed = bySlug.get(recommendation.seed.slug);

                            return seed
                              ? getTechnologyTitleForLocale(seed, locale).text
                              : recommendation.seed.title;
                          })(),
                    locale,
                    seedMark: recommendation.seedMark,
                    matchedTagNames: recommendation.matchedTagIds.flatMap(
                      (tagId) => tagById.get(tagId)?.name ?? []
                    )
                  })}
                </p>
              }
              readingActions={
                <SignalReadingActions
                  isRead={readingState.isRead(item.id)}
                  isSaved={readingState.isSaved(item.id)}
                  onToggleRead={() => readingState.toggleRead(item.id)}
                  onToggleSaved={() => readingState.toggleSaved(item.id)}
                />
              }
              tags={item.tags.flatMap((tagId) => tagById.get(tagId) ?? [])}
            />
          );
        })}
      </div>
    </section>
  );
}
