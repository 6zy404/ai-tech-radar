import Link from "next/link";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierRegisterRow } from "@/components/dossier-register-row";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import {
  getTechnologySummaryForLocale,
  getTechnologyTitleForLocale
} from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

/**
 * Rows shown per topic. A signal is listed under every topic it carries
 * (322 rows for 107 signals on 2026-10-12), so the full lists ran to
 * 54,000px; each topic's hub at /topics/[tagId] keeps the complete list.
 */
export const TIMELINE_TOPIC_LIMIT = 5;

function topicAnchorId(tagId: string): string {
  return `topic-${tagId}`;
}

interface TimelineEntry {
  slug: string;
  title: string;
  summary: string;
  publishDate: string;
  sourceName: string;
  titleLang?: string;
  summaryLang?: string;
}

interface TimelineTopic {
  tagId: string;
  tagName: string;
  tagDescription: string;
  entries: TimelineEntry[];
}

function getTimelineTopics(
  technologies: TechnologyItem[],
  tags: TopicTag[],
  locale: Locale
): TimelineTopic[] {
  const topics: TimelineTopic[] = [];

  for (const tag of tags) {
    const entries = technologies
      .filter((technology) => technology.tags.includes(tag.id))
      .sort((left, right) => right.publishDate.localeCompare(left.publishDate))
      .map((technology) => {
        const title = getTechnologyTitleForLocale(technology, locale);
        const summary = getTechnologySummaryForLocale(technology, locale);

        return {
          slug: technology.slug,
          title: title.text,
          summary: summary.text,
          publishDate: technology.publishDate,
          sourceName: technology.sourceName,
          titleLang: contentLangAttr(locale, title.language),
          summaryLang: contentLangAttr(locale, summary.language)
        };
      });

    if (entries.length > 0) {
      topics.push({
        tagId: tag.id,
        tagName: tag.name,
        tagDescription: tag.description,
        entries
      });
    }
  }

  return topics.sort(
    (left, right) =>
      right.entries.length - left.entries.length ||
      left.tagName.localeCompare(
        right.tagName,
        locale === "en" ? "en" : "zh-CN"
      )
  );
}

interface TopicTimelineSectionProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
  locale?: Locale;
}

export function TopicTimelineSection({
  technologies,
  tags,
  locale = "zh"
}: TopicTimelineSectionProps) {
  const copy = signalsCopy[locale].timeline;
  const topics = getTimelineTopics(technologies, tags, locale);

  return (
    <div className="topic-timeline-section">
      {topics.length > 0 ? (
        <>
          <p className="topic-timeline-section__index">
            <Link href={localePath(locale, "/topics")} className="action-link">
              {copy.allTopics}
            </Link>
          </p>
          {/* Jump links, not a filter, as on /sources: every topic stays
              on the page. */}
          <DossierCategoryChips
            className="topic-timeline-jump"
            ariaLabel={copy.jumpLabel}
            active=""
            options={topics.map((topic) => ({
              value: topic.tagId,
              label: `${topic.tagName} · ${topic.entries.length}`,
              href: `#${topicAnchorId(topic.tagId)}`
            }))}
          />
          {topics.map((topic) => {
            const total = topic.entries.length;
            const isCut = total > TIMELINE_TOPIC_LIMIT;

            return (
              <section
                key={topic.tagId}
                className="timeline-topic"
                aria-labelledby={topicAnchorId(topic.tagId)}
              >
                <div className="timeline-topic__heading">
                  <h2 id={topicAnchorId(topic.tagId)}>{topic.tagName}</h2>
                  <span>
                    {copy.count(total)}
                    {isCut ? copy.recent(TIMELINE_TOPIC_LIMIT) : ""}
                  </span>
                </div>
                <p className="timeline-topic__description">
                  {topic.tagDescription}
                </p>
                <ol className="timeline-topic__list dossier-timeline-list">
                  {topic.entries.slice(0, TIMELINE_TOPIC_LIMIT).map((entry) => (
                    <li key={entry.slug} className="dossier-timeline-node">
                      <DossierRegisterRow
                        headingLevel={3}
                        title={entry.title}
                        date={entry.publishDate}
                        href={localePath(locale, `/technologies/${entry.slug}`)}
                        tag={entry.sourceName}
                        titleLang={entry.titleLang}
                        tagLang={nameLangAttr(locale, entry.sourceName)}
                      />
                      <p
                        className="dossier-timeline-node__summary"
                        lang={entry.summaryLang}
                      >
                        {entry.summary}
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="timeline-topic__more">
                  <Link
                    href={localePath(locale, `/topics/${topic.tagId}`)}
                    className="action-link"
                  >
                    {isCut ? copy.viewTopicAll(total) : copy.viewTopic}
                  </Link>
                </p>
              </section>
            );
          })}
        </>
      ) : (
        <div className="empty-state">
          <strong>{copy.emptyTitle}</strong>
          <p>{copy.emptyBody}</p>
        </div>
      )}
    </div>
  );
}
