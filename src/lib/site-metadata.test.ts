import { describe, expect, it } from "vitest";

import { jsonFeedPath, rssFeedPath, topicFeedPath } from "@/lib/feed-paths";
import {
  buildFeedAlternateTypes,
  buildPageMetadata,
  compactDescription,
  siteName,
  weeklyReviewFeed
} from "@/lib/site-metadata";

const digestRss = { url: rssFeedPath, title: `${siteName} · 技术简报` };
const digestJson = {
  url: jsonFeedPath,
  title: `${siteName} · 技术简报（JSON）`
};

describe("compactDescription", () => {
  // Ten clauses of 14 characters and a comma: 149 characters, 298 wide.
  const chinese = Array.from(
    { length: 10 },
    () => "这句恰有十四个汉字在这里凑数"
  ).join("，");
  const latin =
    "Twelve-character clause here, ".repeat(6).trim() + " and the rest.";

  it("keeps text within both limits as it is", () => {
    expect(compactDescription("短摘要。")).toBe("短摘要。");
    expect(compactDescription(chinese.slice(0, 95))).toBe(chinese.slice(0, 95));
    expect(compactDescription("a".repeat(160))).toBe("a".repeat(160));
  });

  it("cuts Chinese at about a hundred characters, on a clause", () => {
    const result = compactDescription(chinese);

    // The widest prefix under 200 units is 100 characters; the last comma
    // in it sits at index 89, so the cut keeps six clauses.
    expect(result).toBe(`${chinese.slice(0, 90)}…`);
    expect(result.length).toBeLessThanOrEqual(101);
  });

  it("still cuts Latin text at 160 characters", () => {
    expect(latin.length).toBeGreaterThan(160);
    // No ". " in the first 160 characters, so the cut is the limit itself.
    expect(compactDescription(latin)).toBe(`${latin.slice(0, 160).trim()}…`);
  });

  it("never splits a surrogate pair", () => {
    const emoji = "😀".repeat(90); // 180 UTF-16 units, 90 wide

    expect(compactDescription(emoji).endsWith("😀…")).toBe(true);
  });
});

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

describe("buildPageMetadata article dates", () => {
  it("writes publishedTime on an article page only", () => {
    const article = buildPageMetadata({
      path: "/technologies/x",
      type: "article",
      publishedTime: "2026-10-20"
    });

    expect(article.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-10-20"
    });
    expect(
      buildPageMetadata({ path: "/technologies/x", type: "article" }).openGraph
    ).not.toHaveProperty("publishedTime");
    // A website has no article:published_time, whatever a caller passes.
    expect(
      buildPageMetadata({ path: "/digest", publishedTime: "2026-10-20" })
        .openGraph
    ).not.toHaveProperty("publishedTime");
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
