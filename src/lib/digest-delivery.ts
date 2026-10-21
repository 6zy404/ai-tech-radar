import { getDailyDigestRenderData } from "@/lib/digest-view";
import {
  getDailyDigests,
  getDigestTechnologySections
} from "@/lib/digest-workflow";
import {
  getLocalizedTechnologyText,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";
import { jsonFeedPath, rssFeedPath } from "@/lib/feed-paths";
import { digestFeedTitle } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";
import type { DailyDigest, TechnologyItem } from "@/types/content";

export { jsonFeedPath, rssFeedPath };

interface DigestDeliveryTechnology {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishDate: string;
  tags: string[];
}

export interface DigestDeliveryItem {
  date: string;
  title: string;
  summary: string;
  digestUrl: string;
  highPriorityItems: DigestDeliveryTechnology[];
  watchItems: DigestDeliveryTechnology[];
  skillNames: string[];
  knowledgeNames: string[];
  sourceNames: string[];
  publishedAt?: string;
  updatedAt: string;
}

export interface DigestDeliveryFeed {
  title: string;
  description: string;
  homePageUrl: string;
  rssFeedUrl: string;
  jsonFeedUrl: string;
  items: DigestDeliveryItem[];
}

/**
 * The site address — `getSiteUrl` from `src/lib/site-url.ts`, kept under this
 * name for the feed modules that import it from here.
 */
export const getSiteBaseUrl = getSiteUrl;

export function getDigestPublicPath(date: string): string {
  return `/digest/${date}`;
}

export function getDigestPublicUrl(
  date: string,
  baseUrl = getSiteBaseUrl()
): string {
  return `${baseUrl}${getDigestPublicPath(date)}`;
}

export function getDeliverySurfaceUrls(baseUrl = getSiteBaseUrl()) {
  return {
    rssFeedUrl: `${baseUrl}${rssFeedPath}`,
    jsonFeedUrl: `${baseUrl}${jsonFeedPath}`
  };
}

function toPublishedDigests(digests: DailyDigest[]): DailyDigest[] {
  return digests
    .filter((digest) => digest.status === "published")
    .sort((left, right) => right.date.localeCompare(left.date));
}

function getPublicTechnologyText(
  value: TechnologyItem["title"],
  technology: TechnologyItem,
  mode: TechnologyContentMode = "zh"
): string {
  return getLocalizedTechnologyText(value, mode, technology.sourceLanguage);
}

function toDeliveryTechnology(
  technology: TechnologyItem,
  baseUrl = getSiteBaseUrl()
): DigestDeliveryTechnology {
  return {
    title: getPublicTechnologyText(technology.title, technology),
    summary: getPublicTechnologyText(technology.summary, technology),
    url: `${baseUrl}/technologies/${technology.slug}`,
    sourceName: technology.sourceName,
    publishDate: technology.publishDate,
    tags: technology.tags
  };
}

export function toDigestDeliveryItem(
  digest: DailyDigest,
  baseUrl = getSiteBaseUrl()
): DigestDeliveryItem {
  const { highPriorityTechnologies, watchTechnologies } =
    getDigestTechnologySections(digest);
  const renderData = getDailyDigestRenderData(digest);

  return {
    date: digest.date,
    title: getPublicDigestTitle(digest),
    summary: getPublicDigestSummaryPlainText(digest),
    digestUrl: getDigestPublicUrl(digest.date, baseUrl),
    highPriorityItems: highPriorityTechnologies.map((technology) =>
      toDeliveryTechnology(technology, baseUrl)
    ),
    watchItems: watchTechnologies.map((technology) =>
      toDeliveryTechnology(technology, baseUrl)
    ),
    skillNames: renderData.skills.map((skill) => skill.title),
    knowledgeNames: renderData.knowledge.map((knowledge) => knowledge.title),
    sourceNames: digest.sourceNames,
    publishedAt: digest.publishedAt,
    updatedAt: digest.updatedAt
  };
}

export function getDigestDeliveryFeed(
  digests = getDailyDigests(),
  baseUrl = getSiteBaseUrl()
): DigestDeliveryFeed {
  const { rssFeedUrl, jsonFeedUrl } = getDeliverySurfaceUrls(baseUrl);

  return {
    title: digestFeedTitle,
    description:
      "只包含已发布技术简报的公开 feed，草稿和归档内容不会进入 feed。",
    homePageUrl: `${baseUrl}/digest/today`,
    rssFeedUrl,
    jsonFeedUrl,
    items: toPublishedDigests(digests).map((digest) =>
      toDigestDeliveryItem(digest, baseUrl)
    )
  };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatRssDate(
  value: string | undefined,
  fallbackDate: string
): string {
  const date = new Date(value ?? `${fallbackDate}T12:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? new Date(`${fallbackDate}T12:00:00.000Z`).toUTCString()
    : date.toUTCString();
}

/**
 * The text of one digest item in the feeds: the RSS `<description>` and the
 * JSON Feed `content_text` carry the same paragraphs — the summary, the first
 * three signals of each section and the source names.
 */
export function buildDigestItemText(item: DigestDeliveryItem): string {
  return [
    item.summary,
    buildTechnologyListText("今日立即关注", item.highPriorityItems),
    buildTechnologyListText("值得跟踪", item.watchItems),
    item.sourceNames.length > 0
      ? `来源参考: ${item.sourceNames.join(", ")}`
      : "来源参考: 无"
  ].join("\n\n");
}

/** RSS 2.0 wants the lower-case form (`zh-cn`); JSON Feed takes RFC 5646. */
export const rssLanguage = "zh-cn";
export const jsonFeedLanguage = "zh-CN";

export interface RssChannelDocument {
  title: string;
  /** Absolute URL of the page the feed mirrors. */
  link: string;
  description: string;
  /** Absolute URL of the feed itself, written as `<atom:link rel="self">`. */
  feedUrl: string;
  /** The rendered `<item>` elements, already joined; empty for no items. */
  items: string;
}

/**
 * One RSS 2.0 document shape for every feed on the site. Beyond the three
 * required channel fields it writes `<language>` and the feed's own address
 * as `<atom:link rel="self">` — both were missing from all four feeds until
 * 2026-10-21 (seo-10), so aggregators treated the Chinese text as being in
 * their default language and the W3C validator flagged the missing self link.
 */
export function renderRssDocument(channel: RssChannelDocument): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${rssLanguage}</language>`,
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    ...(channel.items ? [channel.items] : []),
    "  </channel>",
    "</rss>"
  ].join("\n");
}

function buildTechnologyListText(
  label: string,
  items: DigestDeliveryTechnology[]
): string {
  if (items.length === 0) {
    return `${label}: 无`;
  }

  return `${label}: ${items
    .slice(0, 3)
    .map((item) => `${item.title} (${item.sourceName})`)
    .join("; ")}`;
}

export function renderDigestRssXml(feed = getDigestDeliveryFeed()): string {
  const items = feed.items
    .map((item) => {
      const description = buildDigestItemText(item);

      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.digestUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.digestUrl)}</guid>`,
        `      <pubDate>${escapeXml(formatRssDate(item.publishedAt, item.date))}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <source url="${escapeXml(feed.rssFeedUrl)}">${escapeXml(feed.title)}</source>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  return renderRssDocument({
    title: feed.title,
    link: feed.homePageUrl,
    description: feed.description,
    feedUrl: feed.rssFeedUrl,
    items
  });
}

/**
 * JSON Feed 1.1. Every item carries `content_text` (the spec requires
 * `content_text` or `content_html`; a strict reader shows an item without
 * either as blank) with the same text as the RSS description, and the feed
 * names its language. The site-specific fields after `summary` predate the
 * feed's readers and stay as they are.
 */
export function renderDigestJsonFeed(feed = getDigestDeliveryFeed()) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: feed.title,
    description: feed.description,
    home_page_url: feed.homePageUrl,
    feed_url: feed.jsonFeedUrl,
    language: jsonFeedLanguage,
    items: feed.items.map((item) => ({
      id: item.digestUrl,
      url: item.digestUrl,
      date_published: item.publishedAt ?? `${item.date}T12:00:00.000Z`,
      date_modified: item.updatedAt,
      title: item.title,
      summary: item.summary,
      content_text: buildDigestItemText(item),
      date: item.date,
      digestUrl: item.digestUrl,
      highPriorityItems: item.highPriorityItems,
      watchItems: item.watchItems,
      skillNames: item.skillNames,
      knowledgeNames: item.knowledgeNames,
      sourceNames: item.sourceNames
    }))
  };
}

export function buildDigestShareText(
  digest: DailyDigest,
  baseUrl = getSiteBaseUrl()
): string {
  const item = toDigestDeliveryItem(digest, baseUrl);
  const immediateLines = item.highPriorityItems
    .slice(0, 3)
    .map((technology, index) => `${index + 1}. ${technology.title}`);
  const watchLines = item.watchItems
    .slice(0, 3)
    .map((technology, index) => `${index + 1}. ${technology.title}`);
  const sections = [
    `${item.title}`,
    `日期: ${item.date}`,
    "",
    item.summary,
    "",
    "今日立即关注:",
    immediateLines.length > 0 ? immediateLines.join("\n") : "- 无",
    "",
    "值得跟踪:",
    watchLines.length > 0 ? watchLines.join("\n") : "- 无",
    "",
    `阅读简报: ${item.digestUrl}`,
    "仅基于已发布技术信号生成。"
  ];

  return sections.join("\n");
}
