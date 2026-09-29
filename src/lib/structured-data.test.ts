import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "@/components/json-ld";
import {
  buildContentJsonLd,
  buildDigestJsonLd,
  buildTechnologyJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd
} from "@/lib/structured-data";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

const siteUrl = "https://example.test";

// Vitest compiles .tsx with the classic JSX runtime (tsconfig says
// "preserve"), which reads a global React. Only <JsonLd> is rendered here.
(globalThis as { React?: typeof React }).React = React;

// Strings that exist only in internal fields. None may reach the output.
const internalMarkers = [
  "INTERNAL-PRIORITY-REASON",
  "INTERNAL-EDITORIAL-NOTE",
  "needs_enrichment",
  "priorityScore",
  "intelligenceStatus",
  "editorialNotes",
  "sourceCandidateId",
  "rawPayload",
  "importanceLevel",
  "translationStatus"
];

function technology(overrides: Partial<TechnologyItem> = {}): TechnologyItem {
  return {
    id: "tech-1",
    slug: "agent-protocol-2",
    status: "published",
    title: { original: "Agent Protocol 2.0", zh: "智能体协议 2.0" },
    summary: {
      original: "A new version of the protocol.",
      zh: "协议的新版本，改为无状态。"
    },
    content: { original: "Body.", zh: "正文。" },
    type: "protocol",
    publishDate: "2026-09-20",
    sourceName: "Example Blog",
    sourceUrl: "https://vendor.example/blog/agent-protocol-2",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "Vendor Inc.",
    publisherType: "big-tech",
    importanceLevel: "critical",
    tags: ["agents"],
    relatedKnowledgeIds: [],
    relatedSkillIds: [],
    // Fields the public shape normally strips, set here to prove the builder
    // would not pass them on even if a caller handed them over.
    priority: {
      priorityLevel: "high_priority",
      priorityScore: 91,
      priorityReasons: ["INTERNAL-PRIORITY-REASON"],
      priorityWarnings: [],
      rankingUpdatedAt: "2026-09-20T00:00:00.000Z",
      rankingSource: "rule_based"
    },
    intelligenceStatus: "needs_enrichment",
    ...overrides
  } as TechnologyItem;
}

const tags: TopicTag[] = [
  { id: "agents", name: "智能体", description: "Agents." }
];

function skill(): SkillItem {
  return {
    id: "skill-1",
    title: "智能体工作流设计",
    slug: "agent-workflow-design",
    summary: "把任务拆成可验证的步骤。",
    content: "## 正文",
    skillType: "engineering",
    heatLevel: "hot",
    learningCost: "medium",
    tags: ["agents"],
    relatedTechnologyIds: [],
    relatedKnowledgeIds: []
  };
}

function knowledge(): KnowledgeItem {
  return {
    id: "knowledge-1",
    title: "检索增强生成",
    slug: "rag",
    summary: "先检索再生成。",
    content: "## 正文",
    category: "machine-learning",
    difficulty: "foundation",
    tags: [],
    relatedTechnologyIds: [],
    relatedSkillIds: []
  };
}

function expectNoInternalFields(data: unknown) {
  const text = JSON.stringify(data);

  for (const marker of internalMarkers) {
    expect(text).not.toContain(marker);
  }
}

describe("buildTechnologyJsonLd", () => {
  it("describes a published signal as a NewsArticle plus breadcrumbs", () => {
    const [article, breadcrumbs] = buildTechnologyJsonLd(
      technology({
        sourceReferences: [
          {
            sourceName: "Example Blog",
            sourceUrl: "https://vendor.example/blog/agent-protocol-2"
          },
          {
            sourceName: "Changelog",
            sourceUrl: "https://github.example/vendor/protocol/releases",
            publisherName: "Vendor Inc.",
            publishDate: "2026-09-19"
          }
        ]
      }),
      tags,
      siteUrl
    )!;

    expect(article).toMatchObject({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: "智能体协议 2.0",
      description: "协议的新版本，改为无状态。",
      datePublished: "2026-09-20",
      inLanguage: "zh-CN",
      url: `${siteUrl}/technologies/agent-protocol-2`,
      image: [`${siteUrl}/technologies/agent-protocol-2/opengraph-image`],
      publisher: { "@type": "Organization", name: "AI Tech Radar" },
      keywords: ["智能体"],
      isBasedOn: {
        "@type": "CreativeWork",
        name: "Agent Protocol 2.0",
        url: "https://vendor.example/blog/agent-protocol-2",
        publisher: { name: "Vendor Inc." }
      }
    });
    // The primary source is `isBasedOn`; only the other references cite.
    expect(article.citation).toEqual([
      {
        "@type": "CreativeWork",
        name: "Changelog",
        url: "https://github.example/vendor/protocol/releases",
        publisher: { "@type": "Organization", name: "Vendor Inc." },
        datePublished: "2026-09-19"
      }
    ]);
    expect(breadcrumbs).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "首页", item: `${siteUrl}/` },
        { position: 2, name: "技术信号", item: `${siteUrl}/technologies` },
        {
          position: 3,
          name: "智能体协议 2.0",
          item: `${siteUrl}/technologies/agent-protocol-2`
        }
      ]
    });
  });

  it("keeps the source language when there is no translation", () => {
    const [article] = buildTechnologyJsonLd(
      technology({
        title: { original: "Agent Protocol 2.0" },
        summary: { original: "A new version." }
      }),
      [],
      siteUrl
    )!;

    expect(article.inLanguage).toBe("en");
    expect(article.headline).toBe("Agent Protocol 2.0");
    expect(article).not.toHaveProperty("keywords");
    expect(article).not.toHaveProperty("citation");
  });

  it("carries public fields only", () => {
    expectNoInternalFields(buildTechnologyJsonLd(technology(), tags, siteUrl));
  });

  it("emits nothing for a draft or an archived record", () => {
    expect(
      buildTechnologyJsonLd(technology({ status: "draft" }), tags, siteUrl)
    ).toBeUndefined();
    expect(
      buildTechnologyJsonLd(technology({ status: "archived" }), tags, siteUrl)
    ).toBeUndefined();
  });
});

describe("buildDigestJsonLd", () => {
  it("lists the digest's published signals in page order", () => {
    const [page, breadcrumbs] = buildDigestJsonLd(
      {
        date: "2026-09-28",
        title: "技术简报 - 2026-09-28",
        summary: "本期两条。",
        path: "/digest/2026-09-28",
        technologies: [
          technology(),
          technology({ id: "tech-draft", slug: "draft", status: "draft" }),
          technology({
            id: "tech-2",
            slug: "second",
            title: { original: "Second" }
          })
        ]
      },
      siteUrl
    );

    expect(page).toMatchObject({
      "@type": "CollectionPage",
      name: "技术简报 - 2026-09-28",
      datePublished: "2026-09-28",
      url: `${siteUrl}/digest/2026-09-28`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: 2,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "智能体协议 2.0",
            url: `${siteUrl}/technologies/agent-protocol-2`
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Second",
            url: `${siteUrl}/technologies/second`
          }
        ]
      }
    });
    expect(breadcrumbs).toMatchObject({
      itemListElement: [
        { name: "首页" },
        { name: "技术简报", item: `${siteUrl}/digest` },
        { name: "技术简报 - 2026-09-28" }
      ]
    });
    expectNoInternalFields(page);
  });
});

describe("buildContentJsonLd", () => {
  it("describes a skill as an Article", () => {
    const [article, breadcrumbs] = buildContentJsonLd(
      "skill",
      skill(),
      tags,
      siteUrl
    );

    expect(article).toMatchObject({
      "@type": "Article",
      headline: "智能体工作流设计",
      articleSection: "技能",
      url: `${siteUrl}/skills/agent-workflow-design`,
      keywords: ["智能体"]
    });
    expect(article).not.toHaveProperty("about");
    expect(breadcrumbs).toMatchObject({
      itemListElement: [
        { name: "首页" },
        { name: "技能", item: `${siteUrl}/skills` },
        { name: "智能体工作流设计" }
      ]
    });
  });

  it("describes a knowledge entry as an Article about a DefinedTerm", () => {
    const [article, breadcrumbs] = buildContentJsonLd(
      "knowledge",
      knowledge(),
      [],
      siteUrl
    );

    expect(article).toMatchObject({
      "@type": "Article",
      articleSection: "知识",
      url: `${siteUrl}/knowledge/rag`,
      about: {
        "@type": "DefinedTerm",
        name: "检索增强生成",
        description: "先检索再生成。"
      }
    });
    expect(breadcrumbs).toMatchObject({
      itemListElement: [{}, { name: "知识", item: `${siteUrl}/knowledge` }, {}]
    });
  });
});

describe("buildWebSiteJsonLd", () => {
  it("names the site", () => {
    expect(buildWebSiteJsonLd(siteUrl)).toMatchObject({
      "@type": "WebSite",
      name: "AI Tech Radar",
      url: `${siteUrl}/`
    });
  });
});

describe("serializeJsonLd", () => {
  const lineSeparator = String.fromCharCode(0x2028);
  const hostile = {
    headline: `</script><script>alert(1)</script> & <!-- ${lineSeparator}`
  };

  it("leaves no character that can end the script element", () => {
    const serialized = serializeJsonLd(hostile);

    expect(serialized).not.toMatch(/[<>&]/);
    expect(serialized).not.toContain(lineSeparator);
  });

  it("parses back to the same data", () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
  });

  it("renders one script element per object through <JsonLd>", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: [hostile, { name: "second" }] })
    );
    const scripts = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([^]*?)<\/script>/g
      )
    ];

    expect(scripts).toHaveLength(2);
    expect(JSON.parse(scripts[0][1])).toEqual(hostile);
    expect(JSON.parse(scripts[1][1])).toEqual({ name: "second" });
  });
});
