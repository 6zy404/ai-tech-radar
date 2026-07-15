import { DossierRegisterRow } from "@/components/dossier-register-row";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type { TechnologyItem, TopicTag } from "@/types/content";

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
        topics.map((topic) => (
          <section key={topic.tagId} className="timeline-topic">
            <div className="timeline-topic__heading">
              <h2>{topic.tagName}</h2>
              <span>{topic.entries.length} 条信号</span>
            </div>
            <p className="timeline-topic__description">
              {topic.tagDescription}
            </p>
            <ol className="timeline-topic__list dossier-timeline-list">
              {topic.entries.map((entry) => (
                <li key={entry.slug} className="dossier-timeline-node">
                  <DossierRegisterRow
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
          </section>
        ))
      ) : (
        <div className="empty-state">
          <strong>还没有可以展示的信号时间线。</strong>
          <p>技术信号发布后会按话题在这里聚合。</p>
        </div>
      )}
    </div>
  );
}
