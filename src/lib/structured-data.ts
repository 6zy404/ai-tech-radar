import { localePath, type Locale } from "@/lib/i18n/locale";
import {
  compactDescription,
  getSiteUrl,
  siteDescriptions,
  siteName
} from "@/lib/site-metadata";
import {
  getTechnologySummaryForLocale,
  getTechnologyTitleForLocale,
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

/*
 * Every builder ends with `siteUrl` and then `locale`. On the English site
 * the URLs are the /en twins and the breadcrumb names are English; each
 * object's `inLanguage` is the language of its name and description — a
 * skill or a digest stays `zh-CN` on the English site, because its text is
 * Chinese.
 */
const crumbNames: Record<
  Locale,
  { home: string; technologies: string; digest: string } & Record<
    ContentKind,
    string
  >
> = {
  zh: {
    home: "首页",
    technologies: "技术信号",
    digest: "技术简报",
    skill: "技能",
    knowledge: "知识"
  },
  en: {
    home: "Home",
    technologies: "Signals",
    digest: "Briefings",
    skill: "Skills",
    knowledge: "Knowledge"
  }
};

function homeCrumb(locale: Locale): Crumb {
  return { name: crumbNames[locale].home, path: localePath(locale, "/") };
}

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
export function buildWebSiteJsonLd(
  siteUrl = getSiteUrl(),
  locale: Locale = "zh"
): JsonLdObject {
  return {
    "@context": context,
    "@type": "WebSite",
    name: siteName,
    url: absolute(siteUrl, localePath(locale, "/")),
    description: siteDescriptions[locale],
    inLanguage: locale === "en" ? "en" : "zh-CN",
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
  siteUrl = getSiteUrl(),
  locale: Locale = "zh"
): JsonLdObject[] | undefined {
  if (technology.status !== "published") {
    return undefined;
  }

  const path = localePath(locale, `/technologies/${technology.slug}`);
  const url = absolute(siteUrl, path);
  const title = getTechnologyTitleForLocale(technology, locale);
  const headline = title.text;
  // The language the title was taken from: on the Chinese site Chinese
  // whenever a translation exists, on the English site English whenever
  // the source is.
  const inLanguage =
    locale === "en"
      ? title.language === "en"
        ? "en"
        : "zh-CN"
      : technology.sourceLanguage === "zh" ||
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
    description: compactDescription(
      getTechnologySummaryForLocale(technology, locale).text
    ),
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
      homeCrumb(locale),
      {
        name: crumbNames[locale].technologies,
        path: localePath(locale, "/technologies")
      },
      { name: headline, path }
    ])
  ];
}

export interface DigestJsonLdInput {
  date: string;
  title: string;
  summary: string;
  /**
   * Where this page is served: `/digest/<date>` or `/digest/today` — the
   * Chinese-site path; the English page passes its locale.
   */
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
  siteUrl = getSiteUrl(),
  locale: Locale = "zh"
): JsonLdObject[] {
  const pagePath = localePath(locale, digest.path);
  const url = absolute(siteUrl, pagePath);
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
        name: getTechnologyTitleForLocale(technology, locale).text,
        url: absolute(
          siteUrl,
          localePath(locale, `/technologies/${technology.slug}`)
        )
      }))
    }
  };

  return [
    page,
    breadcrumbList(siteUrl, [
      homeCrumb(locale),
      { name: crumbNames[locale].digest, path: localePath(locale, "/digest") },
      { name: digest.title, path: pagePath }
    ])
  ];
}

type ContentKind = "skill" | "knowledge";

const contentKinds: Record<ContentKind, { publicPath: string }> = {
  skill: { publicPath: "/skills" },
  knowledge: { publicPath: "/knowledge" }
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
  siteUrl = getSiteUrl(),
  locale: Locale = "zh"
): JsonLdObject[] {
  const { publicPath } = contentKinds[kind];
  const noun = crumbNames[locale][kind];
  const path = localePath(locale, `${publicPath}/${item.slug}`);
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
    // The page's share card (its own opengraph-image route); an Article with
    // no image gets no thumbnail in a result (seo-9).
    image: [absolute(siteUrl, `${path}/opengraph-image`)],
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
      homeCrumb(locale),
      { name: noun, path: localePath(locale, publicPath) },
      { name: item.title, path }
    ])
  ];
}

export interface RadarJsonLdEntry {
  number: number;
  name: string;
  ringReason: string;
}

/**
 * /radar, as a CollectionPage whose main entity is the numbered list of
 * entries — the same list the page renders as the picture's text
 * alternative. Each entry is a DefinedTerm described by its ring reason.
 */
export function buildRadarJsonLd(
  page: { title: string; description: string; latestDate: string },
  entries: readonly RadarJsonLdEntry[],
  siteUrl = getSiteUrl(),
  locale: Locale = "zh"
): JsonLdObject[] {
  const pagePath = localePath(locale, "/radar");
  const url = absolute(siteUrl, pagePath);

  return [
    {
      "@context": context,
      "@type": "CollectionPage",
      name: page.title,
      description: compactDescription(page.description),
      ...(page.latestDate ? { dateModified: page.latestDate } : {}),
      inLanguage: locale === "en" ? "en" : "zh-CN",
      url,
      isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
      publisher: sitePublisher(siteUrl),
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: entries.length,
        itemListElement: entries.map((entry) => ({
          "@type": "ListItem",
          position: entry.number,
          item: {
            "@type": "DefinedTerm",
            name: entry.name,
            description: compactDescription(entry.ringReason)
          }
        }))
      }
    },
    breadcrumbList(siteUrl, [
      homeCrumb(locale),
      { name: page.title, path: pagePath }
    ])
  ];
}
