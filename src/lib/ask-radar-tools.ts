import type {
  AskItemBody,
  AskSearchHit,
  AskSourceKind,
  AskTools
} from "@/lib/ask-radar";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "@/lib/content";
import { searchPublicContentHybrid } from "@/lib/hybrid-search";
import {
  getPreferredTechnologyText,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";

/**
 * The two tools 问雷达 may call, over published content only. The news lane is
 * left out on purpose: it is unedited, and an answer that cites it would carry
 * an editorial voice the item never had.
 */

const perGroupLimit = 3;

const routes: { prefix: string; kind: AskSourceKind; key: string }[] = [
  { prefix: "/technologies/", kind: "technology", key: "T" },
  { prefix: "/skills/", kind: "skill", key: "S" },
  { prefix: "/knowledge/", kind: "knowledge", key: "K" }
];

function describeHref(href: string) {
  const route = routes.find((entry) => href.startsWith(entry.prefix));

  if (!route) {
    return undefined;
  }

  return {
    kind: route.kind,
    key: `${route.key}:${href.slice(route.prefix.length)}`
  };
}

async function search(query: string): Promise<AskSearchHit[]> {
  const results = await searchPublicContentHybrid(query);
  const hits: AskSearchHit[] = [];

  for (const group of [
    results.technologies,
    results.skills,
    results.knowledge
  ]) {
    for (const item of group.slice(0, perGroupLimit)) {
      const described = describeHref(item.href);

      if (described) {
        hits.push({
          key: described.key,
          kind: described.kind,
          title: item.title,
          summary: item.summary,
          href: item.href,
          matchedBy: item.matchedBy
        });
      }
    }
  }

  return hits;
}

async function read(key: string): Promise<AskItemBody | undefined> {
  const [prefix, slug] = [key.slice(0, 1), key.slice(2)];

  if (prefix === "T") {
    const item = getAllTechnologies().find((entry) => entry.slug === slug);

    return item
      ? {
          key,
          kind: "technology",
          title: getPreferredTechnologyTitle(item),
          href: `/technologies/${item.slug}`,
          body: [
            item.whyItMatters ? `为什么重要：${item.whyItMatters}` : "",
            getPreferredTechnologyText(item.content, item.sourceLanguage)
          ]
            .filter(Boolean)
            .join("\n\n")
        }
      : undefined;
  }

  if (prefix === "S") {
    const item = getAllSkills().find((entry) => entry.slug === slug);

    return item
      ? {
          key,
          kind: "skill",
          title: item.title,
          href: `/skills/${item.slug}`,
          body: item.content
        }
      : undefined;
  }

  if (prefix === "K") {
    const item = getAllKnowledge().find((entry) => entry.slug === slug);

    return item
      ? {
          key,
          kind: "knowledge",
          title: item.title,
          href: `/knowledge/${item.slug}`,
          body: item.content
        }
      : undefined;
  }

  return undefined;
}

export const siteAskTools: AskTools = { search, read };
