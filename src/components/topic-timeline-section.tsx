import Link from "next/link";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierRegisterRow } from "@/components/dossier-register-row";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
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
}

interface TimelineTopic {
  tagId: string;
  tagName: string;
  tagDescription: string;
  entries: TimelineEntry[];
}

function getTimelineTopics(
  technologies: TechnologyItem[],
  tags: TopicTag[]
): TimelineTopic[] {
  const topics: TimelineTopic[] = [];

  for (const tag of tags) {
    const entries = technologies
      .filter((technology) => technology.tags.includes(tag.id))
      .sort((left, right) => right.publishDate.localeCompare(left.publishDate))
      .map((technology) => ({
        slug: technology.slug,
        title: getPreferredTechnologyTitle(technology),
        summary: getPreferredTechnologySummary(technology),
        publishDate: technology.publishDate,
        sourceName: technology.sourceName
      }));

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
      left.tagName.localeCompare(right.tagName, "zh-CN")
  );
}

interface TopicTimelineSectionProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

export function TopicTimelineSection({
  technologies,
  tags
}: TopicTimelineSectionProps) {
  const topics = getTimelineTopics(technologies, tags);

  return (
    <div className="topic-timeline-section">
      {topics.length > 0 ? (
        <>
          <p className="topic-timeline-section__index">
            <Link href="/topics" className="action-link">
              查看全部话题
            </Link>
          </p>
          {/* Jump links, not a filter, as on /sources: every topic stays
              on the page. */}
          <DossierCategoryChips
            className="topic-timeline-jump"
            ariaLabel="跳到话题"
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
                    {total} 条信号
                    {isCut ? ` · 最近 ${TIMELINE_TOPIC_LIMIT} 条` : ""}
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
                        href={`/technologies/${entry.slug}`}
                        tag={entry.sourceName}
                      />
                      <p className="dossier-timeline-node__summary">
                        {entry.summary}
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="timeline-topic__more">
                  <Link href={`/topics/${topic.tagId}`} className="action-link">
                    {isCut ? `查看专题 · 共 ${total} 条 →` : "查看专题 →"}
                  </Link>
                </p>
              </section>
            );
          })}
        </>
      ) : (
        <div className="empty-state">
          <strong>还没有可以展示的信号时间线。</strong>
          <p>技术信号发布后会按话题在这里聚合。</p>
        </div>
      )}
    </div>
  );
}
