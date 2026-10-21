import { XMLValidator } from "fast-xml-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSignalFeedTechnologies,
  renderAllSignalsRssXml,
  SIGNAL_FEED_ITEM_LIMIT
} from "@/lib/signal-feed";
import { makeTechnologyItem } from "@/lib/test-factories";
import type { TechnologyItem, TopicTag } from "@/types/content";

const { getAllTechnologiesMock, getAllTagsMock } = vi.hoisted(() => ({
  getAllTechnologiesMock: vi.fn<() => TechnologyItem[]>(),
  getAllTagsMock: vi.fn<() => TopicTag[]>()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: getAllTechnologiesMock,
  getAllTags: getAllTagsMock
}));

const baseUrl = "https://radar.example";

function tech(
  id: string,
  publishDate: string,
  overrides: Partial<TechnologyItem> = {}
): TechnologyItem {
  return makeTechnologyItem({
    id,
    slug: id,
    publishDate,
    status: "published",
    sourceLanguage: "en",
    translationStatus: "done",
    title: { original: `Original ${id}`, zh: `中文 ${id}` },
    summary: { original: `Summary ${id}`, zh: `摘要 ${id}` },
    tags: ["tag-agents"],
    ...overrides
  });
}

function itemTitles(xml: string): string[] {
  return [...xml.matchAll(/<item>\s*<title>([^<]*)<\/title>/g)].map(
    (match) => match[1]
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getAllTagsMock.mockReturnValue([
    { id: "tag-agents", name: "AI 智能体", description: "" },
    { id: "tag-rag", name: "检索 & 增强", description: "" }
  ]);
});

describe("getSignalFeedTechnologies", () => {
  it("keeps published signals only, newest first", () => {
    getAllTechnologiesMock.mockReturnValue([
      tech("middle", "2026-09-10"),
      tech("draft", "2026-09-28", { status: "draft" }),
      tech("newest", "2026-09-20"),
      tech("archived", "2026-09-25", { status: "archived" }),
      tech("oldest", "2026-08-01")
    ]);

    expect(getSignalFeedTechnologies().map((item) => item.id)).toEqual([
      "newest",
      "middle",
      "oldest"
    ]);
  });

  it(`caps the feed at ${SIGNAL_FEED_ITEM_LIMIT} items, dropping the oldest`, () => {
    const technologies = Array.from(
      { length: SIGNAL_FEED_ITEM_LIMIT + 5 },
      (_, index) =>
        tech(
          `s${index}`,
          `2026-0${1 + Math.floor(index / 28)}-${String((index % 28) + 1).padStart(2, "0")}`
        )
    );
    getAllTechnologiesMock.mockReturnValue(technologies);

    const selected = getSignalFeedTechnologies();

    expect(selected).toHaveLength(SIGNAL_FEED_ITEM_LIMIT);
    const cutoff = selected[selected.length - 1].publishDate;
    const dropped = technologies.filter((item) => !selected.includes(item));
    expect(dropped).toHaveLength(5);
    expect(dropped.every((item) => item.publishDate <= cutoff)).toBe(true);
  });
});

describe("renderAllSignalsRssXml", () => {
  it("renders Chinese-preferred titles and summaries linking to the signal page", () => {
    const xml = renderAllSignalsRssXml(
      [tech("kimi-k3", "2026-09-20")],
      baseUrl
    );

    expect(itemTitles(xml)).toEqual(["中文 kimi-k3"]);
    expect(xml).toContain("<description>摘要 kimi-k3</description>");
    expect(xml).toContain(`<link>${baseUrl}/technologies/kimi-k3</link>`);
    expect(xml).toContain(
      `<guid isPermaLink="true">${baseUrl}/technologies/kimi-k3</guid>`
    );
    expect(xml).toContain(`<source url="${baseUrl}/technologies/feed.xml">`);
    expect(xml).toContain(`<link>${baseUrl}/technologies</link>`);
  });

  it("names its language and its own address, and is well-formed", () => {
    const xml = renderAllSignalsRssXml([tech("a", "2026-09-20")], baseUrl);

    expect(xml).toContain("<language>zh-cn</language>");
    expect(xml).toContain(
      `<atom:link href="${baseUrl}/technologies/feed.xml" rel="self" type="application/rss+xml"/>`
    );
    expect(XMLValidator.validate(xml)).toBe(true);
  });

  it("preserves the order it is given", () => {
    const xml = renderAllSignalsRssXml(
      [tech("b", "2026-09-20"), tech("a", "2026-09-10")],
      baseUrl
    );

    expect(itemTitles(xml)).toEqual(["中文 b", "中文 a"]);
  });

  it("emits one category per known tag and skips unknown tag ids", () => {
    const xml = renderAllSignalsRssXml(
      [
        tech("t", "2026-09-20", { tags: ["tag-agents", "tag-gone", "tag-rag"] })
      ],
      baseUrl
    );

    expect(
      [...xml.matchAll(/<category>([^<]*)<\/category>/g)].map((m) => m[1])
    ).toEqual(["AI 智能体", "检索 &amp; 增强"]);
  });

  it("escapes XML special characters in titles, summaries and slugs", () => {
    const xml = renderAllSignalsRssXml(
      [
        tech("a&b", "2026-09-20", {
          title: {
            original: `<script>"x"</script>`,
            zh: `<script>"x"</script>`
          },
          summary: { original: "R&D 'quoted'", zh: "R&D 'quoted'" }
        })
      ],
      baseUrl
    );

    expect(xml).toContain(
      "<title>&lt;script&gt;&quot;x&quot;&lt;/script&gt;</title>"
    );
    expect(xml).toContain(
      "<description>R&amp;D &apos;quoted&apos;</description>"
    );
    expect(xml).toContain(`${baseUrl}/technologies/a&amp;b`);
    expect(xml).not.toContain("<script>");
  });

  it("carries no internal fields", () => {
    const xml = renderAllSignalsRssXml(
      [
        tech("t", "2026-09-20", {
          intelligenceStatus: "needs_enrichment",
          importanceLevel: "critical",
          sourceUrl: "https://upstream.example/secret-post"
        })
      ],
      baseUrl
    );

    for (const internal of [
      "rawPayload",
      "importStatus",
      "normalizedType",
      "duplicateGroupId",
      "editorialNotes",
      "intelligenceStatus",
      "needs_enrichment",
      "priorityScore",
      "critical",
      "upstream.example"
    ]) {
      expect(xml).not.toContain(internal);
    }
  });

  it("renders a valid empty channel when nothing is published", () => {
    const xml = renderAllSignalsRssXml([], baseUrl);

    expect(xml).not.toContain("<item>");
    expect(xml).toMatch(/<\/lastBuildDate>\n  <\/channel>\n<\/rss>$/);
  });
});
