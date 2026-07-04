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
  getPublicDigestSummary,
  getPublicDigestTitle
} from "@/lib/public-copy";
import type { DailyDigest, TechnologyItem } from "@/types/content";

export const rssFeedPath = "/feed.xml";
export const jsonFeedPath = "/feed.json";

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

export function getSiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

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
    summary: getPublicDigestSummary(digest),
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
    title: "AI Tech Radar 每日技术简报",
    description:
      "只包含已发布每日技术简报的公开 feed，草稿和归档内容不会进入 feed。",
    homePageUrl: `${baseUrl}/digest/today`,
    rssFeedUrl,
    jsonFeedUrl,
    items: toPublishedDigests(digests).map((digest) =>
      toDigestDeliveryItem(digest, baseUrl)
    )
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRssDate(
  value: string | undefined,
  fallbackDate: string
): string {
  const date = new Date(value ?? `${fallbackDate}T12:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? new Date(`${fallbackDate}T12:00:00.000Z`).toUTCString()
    : date.toUTCString();
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
      const description = [
        item.summary,
        buildTechnologyListText("今日立即关注", item.highPriorityItems),
        buildTechnologyListText("值得跟踪", item.watchItems),
        item.sourceNames.length > 0
          ? `来源参考: ${item.sourceNames.join(", ")}`
          : "来源参考: 无"
      ].join("\n\n");

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

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${escapeXml(feed.homePageUrl)}</link>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>"
  ].join("\n");
}

export function renderDigestJsonFeed(feed = getDigestDeliveryFeed()) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: feed.title,
    description: feed.description,
    home_page_url: feed.homePageUrl,
    feed_url: feed.jsonFeedUrl,
    items: feed.items.map((item) => ({
      id: item.digestUrl,
      url: item.digestUrl,
      date_published: item.publishedAt ?? `${item.date}T12:00:00.000Z`,
      date_modified: item.updatedAt,
      title: item.title,
      summary: item.summary,
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
