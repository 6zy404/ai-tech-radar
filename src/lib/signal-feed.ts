import { getAllTags, getAllTechnologies } from "@/lib/content";
import {
  escapeXml,
  formatRssDate,
  getSiteBaseUrl
} from "@/lib/digest-delivery";
import { signalFeedPath } from "@/lib/feed-paths";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type { TechnologyItem } from "@/types/content";

/**
 * 技术信号 RSS 的共用渲染：全部信号（/technologies/feed.xml）与话题级
 * （/topics/[tagId]/feed.xml）两个订阅源都走这里，只是频道信息、条目集合与
 * 每条的分类不同。条目只读已发布 TechnologyItem 的公开字段——标题与摘要走
 * 中文优先的本地化 helper，链接指向 /technologies/[slug]。
 */

export interface SignalRssChannel {
  title: string;
  /** Absolute URL of the page the feed mirrors. */
  link: string;
  description: string;
  /** Absolute URL of the feed itself, for each item's `<source>`. */
  feedUrl: string;
}

export function renderSignalRssXml(
  channel: SignalRssChannel,
  technologies: readonly TechnologyItem[],
  baseUrl: string,
  getCategories: (item: TechnologyItem) => readonly string[]
): string {
  const items = technologies
    .map((item) => {
      const itemUrl = `${baseUrl}/technologies/${item.slug}`;

      return [
        "    <item>",
        `      <title>${escapeXml(getPreferredTechnologyTitle(item))}</title>`,
        `      <link>${escapeXml(itemUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>`,
        `      <pubDate>${escapeXml(formatRssDate(undefined, item.publishDate))}</pubDate>`,
        `      <description>${escapeXml(getPreferredTechnologySummary(item))}</description>`,
        ...getCategories(item).map(
          (category) => `      <category>${escapeXml(category)}</category>`
        ),
        `      <source url="${escapeXml(channel.feedUrl)}">${escapeXml(channel.title)}</source>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    ...(items ? [items] : []),
    "  </channel>",
    "</rss>"
  ].join("\n");
}

/**
 * The all-signals feed carries the newest published signals only. A reader
 * subscribing wants what is new; the archive is on the site. 50 covers
 * several weeks at the current publish rate (91 signals since 2026-04).
 */
export const SIGNAL_FEED_ITEM_LIMIT = 50;

export const signalFeedChannelTitle = "AI 技术雷达 · 全部技术信号";

/** Published signals, newest first, capped at `limit`. */
export function getSignalFeedTechnologies(
  limit = SIGNAL_FEED_ITEM_LIMIT
): TechnologyItem[] {
  // getAllTechnologies is already published-only; the filter keeps this
  // feed's boundary local instead of resting on the getter alone.
  return getAllTechnologies()
    .filter((item) => item.status === "published")
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate))
    .slice(0, limit);
}

export function renderAllSignalsRssXml(
  technologies: readonly TechnologyItem[] = getSignalFeedTechnologies(),
  baseUrl: string = getSiteBaseUrl()
): string {
  const tagNames = new Map(getAllTags().map((tag) => [tag.id, tag.name]));

  return renderSignalRssXml(
    {
      title: signalFeedChannelTitle,
      link: `${baseUrl}/technologies`,
      description:
        "编辑发布的全部 AI 技术信号，最新在前。只含已发布信号，不含自动聚合的快讯。",
      feedUrl: `${baseUrl}${signalFeedPath}`
    },
    technologies,
    baseUrl,
    (item) =>
      item.tags.flatMap((tagId) => {
        const name = tagNames.get(tagId);
        return name ? [name] : [];
      })
  );
}
