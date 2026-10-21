import { getAllTags, getAllTechnologies } from "@/lib/content";
import { getSiteBaseUrl } from "@/lib/digest-delivery";
import { topicFeedPath } from "@/lib/feed-paths";
import { renderSignalRssXml } from "@/lib/signal-feed";
import { topicFeedTitle } from "@/lib/site-metadata";

/**
 * 话题级 RSS（/topics/[tagId]/feed.xml）：某一话题下已发布技术信号的公开
 * 订阅源。只包含编辑发布的精选信号——快讯候选、草稿、归档内容不进入
 * feed。未知话题或没有任何已发布信号的话题返回 undefined（路由渲染 404），
 * 与 /topics/[tagId] 页面的存在性规则对齐但更严格（页面允许仅有技能/知识
 * 的话题，feed 必须有信号可订阅）。条目渲染与全部信号 feed 共用
 * `renderSignalRssXml`。
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

  return renderSignalRssXml(
    {
      title: topicFeedTitle(tag.name),
      link: `${baseUrl}/topics/${tagId}`,
      description: `话题「${tag.name}」下已发布技术信号的更新订阅源。${tag.description}`,
      feedUrl: `${baseUrl}${topicFeedPath(tagId)}`
    },
    technologies,
    baseUrl,
    () => [tag.name]
  );
}
