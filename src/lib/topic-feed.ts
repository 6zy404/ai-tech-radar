import { getAllTags, getAllTechnologies } from "@/lib/content";
import {
  escapeXml,
  formatRssDate,
  getSiteBaseUrl
} from "@/lib/digest-delivery";
import { topicFeedPath } from "@/lib/feed-paths";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";

/**
 * 话题级 RSS（/topics/[tagId]/feed.xml）：某一话题下已发布技术信号的公开
 * 订阅源。只包含编辑发布的精选信号——快讯候选、草稿、归档内容不进入
 * feed。未知话题或没有任何已发布信号的话题返回 undefined（路由渲染 404），
 * 与 /topics/[tagId] 页面的存在性规则对齐但更严格（页面允许仅有技能/知识
 * 的话题，feed 必须有信号可订阅）。
 */
export function renderTopicRssXml(tagId: string): string | undefined {
  const tag = getAllTags().find((item) => item.id === tagId);

  if (!tag) {
    return undefined;
  }

  const technologies = getAllTechnologies()
    .filter((item) => item.tags.includes(tagId))
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate));

  if (technologies.length === 0) {
    return undefined;
  }

  const baseUrl = getSiteBaseUrl();
  const feedUrl = `${baseUrl}${topicFeedPath(tagId)}`;
  const topicUrl = `${baseUrl}/topics/${tagId}`;
  const channelTitle = `AI 技术雷达 · ${tag.name}`;

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
        `      <category>${escapeXml(tag.name)}</category>`,
        `      <source url="${escapeXml(feedUrl)}">${escapeXml(channelTitle)}</source>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(topicUrl)}</link>`,
    `    <description>${escapeXml(
      `话题「${tag.name}」下已发布技术信号的更新订阅源。${tag.description}`
    )}</description>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>"
  ].join("\n");
}
