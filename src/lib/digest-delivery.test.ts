import { XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";

import {
  buildDigestItemText,
  renderDigestJsonFeed,
  renderDigestRssXml,
  renderRssDocument,
  type DigestDeliveryFeed
} from "@/lib/digest-delivery";

const baseUrl = "https://radar.example";

function feed(): DigestDeliveryFeed {
  return {
    title: "AI Tech Radar 技术简报",
    description: "只包含已发布技术简报的公开 feed。",
    homePageUrl: `${baseUrl}/digest/today`,
    rssFeedUrl: `${baseUrl}/feed.xml`,
    jsonFeedUrl: `${baseUrl}/feed.json`,
    items: [
      {
        date: "2026-10-20",
        title: "技术简报 - 2026-10-20",
        summary: "这一期两条。",
        digestUrl: `${baseUrl}/digest/2026-10-20`,
        highPriorityItems: [
          {
            title: "Gemini 4 Argon 全面开放",
            summary: "摘要。",
            url: `${baseUrl}/technologies/gemini-4-argon`,
            sourceName: "Google DeepMind Blog",
            publishDate: "2026-10-20",
            tags: ["frontier-models"]
          }
        ],
        watchItems: [],
        skillNames: ["模型评测"],
        knowledgeNames: ["混合专家"],
        sourceNames: ["Google DeepMind Blog", "vLLM Releases"],
        publishedAt: "2026-10-20T03:10:21.000Z",
        updatedAt: "2026-10-20T03:10:21.000Z"
      }
    ]
  };
}

describe("renderRssDocument", () => {
  it("writes the language and the feed's own address beside the required channel fields", () => {
    const xml = renderRssDocument({
      title: "T & U",
      link: `${baseUrl}/x`,
      description: "D",
      feedUrl: `${baseUrl}/x/feed.xml?a=1&b=2`,
      items: ""
    });

    expect(xml).toContain(
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'
    );
    expect(xml).toContain("<title>T &amp; U</title>");
    expect(xml).toContain("<language>zh-cn</language>");
    expect(xml).toContain(
      `<atom:link href="${baseUrl}/x/feed.xml?a=1&amp;b=2" rel="self" type="application/rss+xml"/>`
    );
    expect(xml).toMatch(/<\/lastBuildDate>\n {2}<\/channel>\n<\/rss>$/);
    expect(XMLValidator.validate(xml)).toBe(true);
  });
});

describe("renderDigestRssXml", () => {
  it("is well-formed XML with the self link and one item per digest", () => {
    const xml = renderDigestRssXml(feed());

    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain(
      `<atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>`
    );
    expect(xml).toContain("<language>zh-cn</language>");
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain(
      `<guid isPermaLink="true">${baseUrl}/digest/2026-10-20</guid>`
    );
    expect(xml).toContain(
      "今日立即关注: Gemini 4 Argon 全面开放 (Google DeepMind Blog)"
    );
  });

  it("renders a well-formed empty channel", () => {
    const xml = renderDigestRssXml({ ...feed(), items: [] });

    expect(xml).not.toContain("<item>");
    expect(XMLValidator.validate(xml)).toBe(true);
  });
});

describe("renderDigestJsonFeed", () => {
  it("gives every item content_text, the same text as the RSS description, and names the language", () => {
    const json = renderDigestJsonFeed(feed());
    const [item] = json.items;

    expect(json.version).toBe("https://jsonfeed.org/version/1.1");
    expect(json.language).toBe("zh-CN");
    expect(item.content_text).toBe(buildDigestItemText(feed().items[0]));
    expect(item.content_text).toContain("这一期两条。");
    expect(item.content_text).toContain("值得跟踪: 无");
    expect(item.content_text).toContain(
      "来源参考: Google DeepMind Blog, vLLM Releases"
    );
    expect(item).toMatchObject({
      id: `${baseUrl}/digest/2026-10-20`,
      url: `${baseUrl}/digest/2026-10-20`,
      date_published: "2026-10-20T03:10:21.000Z",
      title: "技术简报 - 2026-10-20",
      summary: "这一期两条。"
    });
    // The site-specific fields readers may already use are unchanged.
    expect(item.highPriorityItems).toHaveLength(1);
    expect(item.sourceNames).toEqual(["Google DeepMind Blog", "vLLM Releases"]);
  });
});
