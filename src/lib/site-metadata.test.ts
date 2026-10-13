import { describe, expect, it } from "vitest";

import { jsonFeedPath, rssFeedPath, topicFeedPath } from "@/lib/feed-paths";
import {
  buildFeedAlternateTypes,
  buildPageMetadata,
  siteName,
  weeklyReviewFeed
} from "@/lib/site-metadata";

const digestRss = { url: rssFeedPath, title: `${siteName} · 技术简报` };
const digestJson = {
  url: jsonFeedPath,
  title: `${siteName} · 技术简报（JSON）`
};

describe("buildFeedAlternateTypes", () => {
  it("announces the digest RSS and JSON feeds under their own MIME types", () => {
    expect(buildFeedAlternateTypes()).toEqual({
      "application/rss+xml": [digestRss],
      "application/feed+json": [digestJson]
    });
  });

  it("puts a page's own feed ahead of the digest feed", () => {
    const types = buildFeedAlternateTypes([weeklyReviewFeed]);

    expect(types["application/rss+xml"]).toEqual([
      { url: "/digest/weekly/feed.xml", title: `${siteName} · 本周回顾` },
      digestRss
    ]);
    expect(types["application/feed+json"]).toEqual([digestJson]);
  });
});

describe("buildPageMetadata share card", () => {
  it("uses the small card unless the page has a wide image", () => {
    expect(buildPageMetadata({ path: "/skills" }).twitter).toMatchObject({
      card: "summary"
    });
    expect(
      buildPageMetadata({ path: "/technologies/x", largeImage: true }).twitter
    ).toMatchObject({ card: "summary_large_image" });
  });
});

describe("buildPageMetadata feeds", () => {
  it("keeps the digest feeds on a page that passes none", () => {
    // A page's `alternates` replaces the layout's, so dropping them here
    // would drop them from every page that has its own metadata.
    const metadata = buildPageMetadata({ path: "/skills" });

    expect(metadata.alternates).toEqual({
      canonical: "/skills",
      languages: {
        "zh-CN": "/skills",
        en: "/en/skills",
        "x-default": "/skills"
      },
      types: buildFeedAlternateTypes()
    });
  });

  it("adds the page's feeds beside the canonical URL", () => {
    const metadata = buildPageMetadata({
      title: "智能体 · 专题",
      path: "/topics/agents",
      feeds: [{ path: topicFeedPath("agents"), title: "话题：智能体" }]
    });

    expect(metadata.alternates?.canonical).toBe("/topics/agents");
    expect(metadata.alternates?.types?.["application/rss+xml"]).toEqual([
      { url: "/topics/agents/feed.xml", title: "话题：智能体" },
      digestRss
    ]);
  });

  it("files a JSON feed under the JSON Feed MIME type", () => {
    const metadata = buildPageMetadata({
      path: "/x",
      feeds: [{ path: "/x/feed.json", title: "X", format: "json" }]
    });

    expect(metadata.alternates?.types?.["application/feed+json"]).toEqual([
      { url: "/x/feed.json", title: "X" },
      digestJson
    ]);
  });
});

describe("buildPageMetadata languages", () => {
  it("names both versions on both versions, with the Chinese one as x-default", () => {
    const zh = buildPageMetadata({ path: "/radar" });
    const en = buildPageMetadata({ path: "/radar", locale: "en" });
    const pair = {
      "zh-CN": "/radar",
      en: "/en/radar",
      "x-default": "/radar"
    };

    expect(zh.alternates?.languages).toEqual(pair);
    expect(en.alternates?.languages).toEqual(pair);
    expect(en.alternates?.canonical).toBe("/en/radar");
  });

  it("names no other language for a page with no English twin", () => {
    expect(
      buildPageMetadata({ path: "/offline" }).alternates?.languages
    ).toBeUndefined();
  });
});
