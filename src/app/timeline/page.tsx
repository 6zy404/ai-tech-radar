import Link from "next/link";

import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";

export const dynamic = "force-dynamic";

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

function getTimelineTopics(): TimelineTopic[] {
  const technologies = getAllTechnologies();
  const topics: TimelineTopic[] = [];

  for (const tag of getAllTags()) {
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

export default function TimelinePage() {
  const topics = getTimelineTopics();

  return (
    <UserPageShell
      title="主题时间线"
      description="按话题查看已发布技术信号的时间演进：同一主题下先后发生了什么，一眼看清脉络。"
      sectionLabel="时间线"
      className="timeline-page"
      actions={
        <Link href="/radar" className="action-link">
          关注感兴趣的话题
        </Link>
      }
    >
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
            <ol className="timeline-topic__list">
              {topic.entries.map((entry) => (
                <li key={entry.slug} className="timeline-node">
                  <div className="timeline-node__date">{entry.publishDate}</div>
                  <div className="timeline-node__body">
                    <h3>
                      <Link href={`/technologies/${entry.slug}`}>
                        {entry.title}
                      </Link>
                    </h3>
                    <p>{entry.summary}</p>
                    <span className="timeline-node__source">
                      {entry.sourceName}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      ) : (
        <div className="empty-state empty-state--actionable">
          <strong>还没有可以展示的信号时间线。</strong>
          <p>技术信号发布后会按话题在这里聚合。你可以先浏览技术信号流。</p>
          <Link href="/technologies" className="action-link">
            浏览技术信号
          </Link>
        </div>
      )}
    </UserPageShell>
  );
}
