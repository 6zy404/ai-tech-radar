import {
  compactDescription,
  getSiteUrl,
  siteDescription,
  siteName
} from "@/lib/site-metadata";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle,
  hasLocalizedText
} from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

/**
 * schema.org JSON-LD for the public pages. Every builder takes the public
 * shape a page already renders and picks fields by name, so nothing reaches
 * the output unless it is listed here — ranking, `intelligenceStatus`,
 * editorial notes and every workspace field stay out by construction, and
 * the tests assert it. URLs are absolute on `NEXT_PUBLIC_SITE_URL`, the same
 * base `metadataBase` gives the Open Graph tags.
 */

export type JsonLdObject = { "@context": "https://schema.org" } & Record<
  string,
  unknown
>;

const context = "https://schema.org" as const;

function absolute(siteUrl: string, path: string): string {
  return `${siteUrl}${path}`;
}

function sitePublisher(siteUrl: string) {
  return { "@type": "Organization", name: siteName, url: siteUrl };
}

interface Crumb {
  name: string;
  path: string;
}

function breadcrumbList(siteUrl: string, crumbs: readonly Crumb[]) {
  return {
    "@context": context,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(siteUrl, crumb.path)
    }))
  } satisfies JsonLdObject;
}

const home: Crumb = { name: "首页", path: "/" };

// Built from char codes: an escape written in the source is one tool pass
// away from becoming the raw character, which ends a regex literal.
const lineSeparators = new RegExp(
  `[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`,
  "g"
);

/** `<` → backslash, `u`, `003c`: the JSON escape for one character. */
function jsonEscape(char: string): string {
  return `${String.fromCharCode(92)}u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

/**
 * Serializes for a `<script type="application/ld+json">`. A `<` inside a
 * title would otherwise let a string close the script element, so it and
 * the other HTML-significant characters are written as JSON escapes, which
 * parse back to the same string. U+2028/2029 are escaped too: valid in JSON,
 * but line terminators to older script parsers.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/[<>&]/g, jsonEscape)
    .replace(lineSeparators, jsonEscape);
}

/** The home page: the site itself. */
export function buildWebSiteJsonLd(siteUrl = getSiteUrl()): JsonLdObject {
  return {
    "@context": context,
    "@type": "WebSite",
    name: siteName,
    url: absolute(siteUrl, "/"),
    description: siteDescription,
    inLanguage: "zh-CN",
    publisher: sitePublisher(siteUrl)
  };
}

/**
 * A signal page, as a NewsArticle about the external announcement it is
 * based on. Returns nothing for anything but a published record: the
 * workspace preview renders drafts through the same detail component, and a
 * draft must never describe itself to a crawler.
 */
export function buildTechnologyJsonLd(
  technology: TechnologyItem,
  tags: readonly TopicTag[],
  siteUrl = getSiteUrl()
): JsonLdObject[] | undefined {
  if (technology.status !== "published") {
    return undefined;
  }

  const path = `/technologies/${technology.slug}`;
  const url = absolute(siteUrl, path);
  const headline = getPreferredTechnologyTitle(technology);
  // The page reads Chinese whenever a translation exists, so the language
  // is the one the preferred title was taken from.
  const inLanguage =
    technology.sourceLanguage === "zh" ||
    hasLocalizedText(technology.title, "zh")
      ? "zh-CN"
      : technology.sourceLanguage;
  const primarySourceUrl = technology.sourceUrl;
  const citations = (technology.sourceReferences ?? [])
    .filter((reference) => reference.sourceUrl !== primarySourceUrl)
    .map((reference) => ({
      "@type": "CreativeWork",
      name: reference.sourceName,
      url: reference.sourceUrl,
      ...(reference.publisherName
        ? {
            publisher: {
              "@type": "Organization",
              name: reference.publisherName
            }
          }
        : {}),
      ...(reference.publishDate ? { datePublished: reference.publishDate } : {})
    }));

  const article: JsonLdObject = {
    "@context": context,
    "@type": "NewsArticle",
    headline,
    description: compactDescription(getPreferredTechnologySummary(technology)),
    datePublished: technology.publishDate,
    inLanguage,
    url,
    mainEntityOfPage: url,
    image: [absolute(siteUrl, `${path}/opengraph-image`)],
    author: sitePublisher(siteUrl),
    publisher: sitePublisher(siteUrl),
    ...(tags.length > 0 ? { keywords: tags.map((tag) => tag.name) } : {}),
    isBasedOn: {
      "@type": "CreativeWork",
      name: technology.title.original,
      url: primarySourceUrl,
      inLanguage: technology.sourceLanguage,
      ...(technology.publisherName
        ? {
            publisher: {
              "@type": "Organization",
              name: technology.publisherName
            }
          }
        : {})
    },
    ...(citations.length > 0 ? { citation: citations } : {})
  };

  return [
    article,
    breadcrumbList(siteUrl, [
      home,
      { name: "技术信号", path: "/technologies" },
      { name: headline, path }
    ])
  ];
}

export interface DigestJsonLdInput {
  date: string;
  title: string;
  summary: string;
  /** Where this page is served: `/digest/<date>` or `/digest/today`. */
  path: string;
  /** Page order: immediate-attention first, then worth-tracking. */
  technologies: readonly TechnologyItem[];
}

/**
 * A digest page, as a CollectionPage whose main entity is the ordered list
 * of the signals it carries. Takes the public digest view's title and
 * summary rather than the workflow object, and drops any signal that is not
 * published.
 */
export function buildDigestJsonLd(
  digest: DigestJsonLdInput,
  siteUrl = getSiteUrl()
): JsonLdObject[] {
  const url = absolute(siteUrl, digest.path);
  const items = digest.technologies.filter(
    (technology) => technology.status === "published"
  );

  const page: JsonLdObject = {
    "@context": context,
    "@type": "CollectionPage",
    name: digest.title,
    description: compactDescription(digest.summary),
    datePublished: digest.date,
    inLanguage: "zh-CN",
    url,
    isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
    publisher: sitePublisher(siteUrl),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((technology, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: getPreferredTechnologyTitle(technology),
        url: absolute(siteUrl, `/technologies/${technology.slug}`)
      }))
    }
  };

  return [
    page,
    breadcrumbList(siteUrl, [
      home,
      { name: "技术简报", path: "/digest" },
      { name: digest.title, path: digest.path }
    ])
  ];
}

type ContentKind = "skill" | "knowledge";

const contentKinds: Record<ContentKind, { noun: string; publicPath: string }> =
  {
    skill: { noun: "技能", publicPath: "/skills" },
    knowledge: { noun: "知识", publicPath: "/knowledge" }
  };

/**
 * A skill or knowledge page, as an Article: the page is a written
 * explanation with a body, not a glossary line. A knowledge entry is a
 * concept, so its Article is additionally `about` a DefinedTerm. Skill and
 * knowledge records carry no dates, so none are invented.
 */
export function buildContentJsonLd(
  kind: ContentKind,
  item: SkillItem | KnowledgeItem,
  tags: readonly TopicTag[],
  siteUrl = getSiteUrl()
): JsonLdObject[] {
  const { noun, publicPath } = contentKinds[kind];
  const path = `${publicPath}/${item.slug}`;
  const url = absolute(siteUrl, path);
  const description = compactDescription(item.summary);

  const article: JsonLdObject = {
    "@context": context,
    "@type": "Article",
    headline: item.title,
    description,
    articleSection: noun,
    inLanguage: "zh-CN",
    url,
    mainEntityOfPage: url,
    author: sitePublisher(siteUrl),
    publisher: sitePublisher(siteUrl),
    ...(tags.length > 0 ? { keywords: tags.map((tag) => tag.name) } : {}),
    ...(kind === "knowledge"
      ? { about: { "@type": "DefinedTerm", name: item.title, description } }
      : {})
  };

  return [
    article,
    breadcrumbList(siteUrl, [
      home,
      { name: noun, path: publicPath },
      { name: item.title, path }
    ])
  ];
}
