import type { MetadataRoute } from "next";

import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies
} from "@/lib/content";
import { getDailyDigests } from "@/lib/digest-workflow";
import { getSiteUrl } from "@/lib/site-metadata";
import { getTopicIndex } from "@/lib/topic-hub";
import { getWeeklyReviewArchive } from "@/lib/weekly-review";

// Reads runtime content, so it must be served per request like the pages.
export const dynamic = "force-dynamic";

/**
 * Every public page a crawler should find: the fixed routes plus one entry per
 * published signal, skill, knowledge entry, digest, topic hub and past week.
 * Only published content is listed; the getters already filter drafts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const absolute = (path: string) => `${siteUrl}${path}`;

  const fixed: MetadataRoute.Sitemap = [
    { url: absolute("/"), changeFrequency: "daily", priority: 1 },
    { url: absolute("/technologies"), changeFrequency: "daily", priority: 0.9 },
    {
      url: absolute("/technologies?view=news"),
      changeFrequency: "daily",
      priority: 0.5
    },
    {
      url: absolute("/technologies?view=timeline"),
      changeFrequency: "weekly",
      priority: 0.5
    },
    { url: absolute("/digest"), changeFrequency: "daily", priority: 0.8 },
    { url: absolute("/digest/today"), changeFrequency: "daily", priority: 0.8 },
    {
      url: absolute("/digest/weekly"),
      changeFrequency: "weekly",
      priority: 0.6
    },
    { url: absolute("/radar"), changeFrequency: "weekly", priority: 0.7 },
    { url: absolute("/skills"), changeFrequency: "weekly", priority: 0.7 },
    { url: absolute("/knowledge"), changeFrequency: "weekly", priority: 0.7 },
    { url: absolute("/topics"), changeFrequency: "weekly", priority: 0.6 },
    { url: absolute("/sources"), changeFrequency: "weekly", priority: 0.5 },
    { url: absolute("/network"), changeFrequency: "weekly", priority: 0.5 },
    { url: absolute("/ask"), changeFrequency: "monthly", priority: 0.5 },
    { url: absolute("/about"), changeFrequency: "monthly", priority: 0.4 }
  ];

  const technologies: MetadataRoute.Sitemap = getAllTechnologies().map(
    (item) => ({
      url: absolute(`/technologies/${item.slug}`),
      lastModified: item.publishDate,
      changeFrequency: "monthly",
      priority: 0.8
    })
  );

  const skills: MetadataRoute.Sitemap = getAllSkills().map((item) => ({
    url: absolute(`/skills/${item.slug}`),
    changeFrequency: "monthly",
    priority: 0.7
  }));

  const knowledge: MetadataRoute.Sitemap = getAllKnowledge().map((item) => ({
    url: absolute(`/knowledge/${item.slug}`),
    changeFrequency: "monthly",
    priority: 0.7
  }));

  const digests: MetadataRoute.Sitemap = getDailyDigests()
    .filter((digest) => digest.status === "published")
    .map((digest) => ({
      url: absolute(`/digest/${digest.date}`),
      lastModified: digest.publishedAt ?? digest.updatedAt,
      changeFrequency: "yearly",
      priority: 0.6
    }));

  // `getTopicIndex` lists exactly the topics whose hub exists (the same rule
  // as `getTopicHub`'s notFound) without building each hub: calling
  // `getTopicHub` per tag built the whole content graph 19 times, about 1s of
  // blocking work per request. The tag order is kept.
  const topicIds = new Set(getTopicIndex().topics.map((topic) => topic.id));
  const topics: MetadataRoute.Sitemap = getAllTags()
    .filter((tag) => topicIds.has(tag.id))
    .map((tag) => ({
      url: absolute(`/topics/${tag.id}`),
      changeFrequency: "weekly",
      priority: 0.6
    }));

  const weeks: MetadataRoute.Sitemap = getWeeklyReviewArchive().map(
    (entry) => ({
      url: absolute(`/digest/weekly/${entry.weekKey}`),
      changeFrequency: "yearly",
      priority: 0.4
    })
  );

  return [
    ...fixed,
    ...technologies,
    ...skills,
    ...knowledge,
    ...digests,
    ...topics,
    ...weeks
  ];
}
