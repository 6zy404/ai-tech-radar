import type { Metadata } from "next";

import {
  jsonFeedPath,
  rssFeedPath,
  signalFeedPath,
  weeklyReviewFeedPath
} from "@/lib/feed-paths";
import {
  hasEnglishTwin,
  hreflangs,
  localePath,
  openGraphLocales,
  type Locale
} from "@/lib/i18n/locale";

/**
 * One place for what search engines and share cards see. Until 2026-09-24
 * every public page shared a single title and a description that called the
 * site a "local prototype"; there was no canonical URL, Open Graph, sitemap or
 * robots file. Pages call `buildPageMetadata` so the title template, the
 * canonical URL and the share card stay consistent, and so a description is
 * never longer than a result snippet shows.
 */

export const siteName = "AI Tech Radar";

export const siteDescription =
  "追踪值得优先关注的 AI 技术信号，并用技能与背景知识解释它为什么重要、谁该关注。";

export const siteDescriptions: Record<Locale, string> = {
  zh: siteDescription,
  en: "Tracks the AI technology signals worth attention first, and uses skills and background knowledge to explain why each matters and who should care."
};

// The site address lives in `src/lib/site-url.ts` since 2026-10-21 (it was
// defined here and again in digest-delivery.ts); re-exported for the pages.
export { getSiteUrl } from "@/lib/site-url";

const descriptionMaxLength = 160;

/**
 * Trims a summary to snippet length on a clause boundary when one is near,
 * so a description never ends mid-word. Whitespace runs are collapsed first
 * because summaries can carry line breaks.
 */
export function compactDescription(
  text: string,
  maxLength = descriptionMaxLength
): string {
  const collapsed = text.replace(/\s+/g, " ").trim();

  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  const head = collapsed.slice(0, maxLength);
  const clauseEnd = Math.max(
    head.lastIndexOf("。"),
    head.lastIndexOf("；"),
    head.lastIndexOf("，"),
    head.lastIndexOf(". ")
  );
  const cut = clauseEnd >= maxLength * 0.6 ? clauseEnd + 1 : maxLength;

  return `${head.slice(0, cut).trim()}…`;
}

/** A feed a page announces with `<link rel="alternate">`. */
export interface PageFeed {
  /** Path from the site root, e.g. `/topics/agents/feed.xml`. */
  path: string;
  /** What a feed reader lists it as. */
  title: string;
  /**
   * The same on English pages. Every feed is in Chinese — there are no
   * English feeds — so the title says so. Falls back to `title`.
   */
  titleEn?: string;
  /** Defaults to `rss`; only the digest also has a JSON Feed. */
  format?: "rss" | "json";
}

const feedMimeTypes: Record<NonNullable<PageFeed["format"]>, string> = {
  rss: "application/rss+xml",
  json: "application/feed+json"
};

/** The digest feeds, announced on every page. */
export const siteFeeds: readonly PageFeed[] = [
  {
    path: rssFeedPath,
    title: `${siteName} · 技术简报`,
    titleEn: `${siteName} · Briefings (in Chinese)`
  },
  {
    path: jsonFeedPath,
    title: `${siteName} · 技术简报（JSON）`,
    titleEn: `${siteName} · Briefings (JSON, in Chinese)`,
    format: "json"
  }
];

/** Announced by `/digest/weekly` and `/digest/weekly/[week]`. */
export const weeklyReviewFeed: PageFeed = {
  path: weeklyReviewFeedPath,
  title: `${siteName} · 本周回顾`,
  titleEn: `${siteName} · Weekly review (in Chinese)`
};

/** Announced by every view of `/technologies`. */
export const signalFeed: PageFeed = {
  path: signalFeedPath,
  title: `${siteName} · 全部技术信号`,
  titleEn: `${siteName} · All signals (in Chinese)`
};

type FeedAlternateTypes = Record<string, { url: string; title: string }[]>;

/**
 * The `alternates.types` value for a page: its own feeds first, so a reader
 * that takes the first `rel="alternate"` subscribes to what the page is
 * about, then the site-wide digest feeds.
 */
export function buildFeedAlternateTypes(
  pageFeeds: readonly PageFeed[] = [],
  locale: Locale = "zh"
): FeedAlternateTypes {
  const types: FeedAlternateTypes = {};

  for (const feed of [...pageFeeds, ...siteFeeds]) {
    const mimeType = feedMimeTypes[feed.format ?? "rss"];
    (types[mimeType] ??= []).push({
      url: feed.path,
      title: locale === "en" ? (feed.titleEn ?? feed.title) : feed.title
    });
  }

  return types;
}

/**
 * `<link rel="alternate" hreflang>` for both versions of a page, plus
 * `x-default` pointing at the Chinese one, the site's own language. Both
 * versions print the same set, so each names the other.
 */
export function buildLanguageAlternates(path: string): Record<string, string> {
  return {
    [hreflangs.zh]: localePath("zh", path),
    [hreflangs.en]: localePath("en", path),
    "x-default": localePath("zh", path)
  };
}

export interface PageMetadataInput {
  /** Page title without the site name; the layout template appends it. */
  title?: string;
  /** Description for the result snippet and the share card. */
  description?: string;
  /** Path from the site root, e.g. `/technologies/kimi-k3`. */
  path: string;
  /** `article` for a single record, `website` for lists and tools. */
  type?: "website" | "article";
  /**
   * When the record was published (`YYYY-MM-DD` or an ISO timestamp), written
   * as `article:published_time`. Read only for `type: "article"`. No
   * modified time: the public data has no trustworthy one (bulk scripts do
   * not touch `updatedAt`).
   */
  publishedTime?: string;
  /** Set when the page has nothing worth indexing (search results, a query). */
  noIndex?: boolean;
  /**
   * Feeds specific to this page, announced ahead of the digest feeds. Pass
   * only a feed that exists — the topic feed 404s for a topic with no
   * published signal.
   */
  feeds?: readonly PageFeed[];
  /**
   * Set when the page has a wide share image (an `opengraph-image` route),
   * so X renders it as a large card. Pages without one keep the small
   * card: a large card with no image has nothing to fill it with.
   */
  largeImage?: boolean;
  /**
   * The interface language. `path` stays the Chinese-site path; the English
   * page's canonical and Open Graph URL are its /en twin.
   */
  locale?: Locale;
}

export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  noIndex = false,
  feeds = [],
  largeImage = false,
  locale = "zh"
}: PageMetadataInput): Metadata {
  const resolvedDescription = compactDescription(
    description ?? siteDescriptions[locale]
  );
  const pagePath = localePath(locale, path);
  const fullTitle = title ? `${title} · ${siteName}` : siteName;
  const openGraphBase = {
    title: fullTitle,
    description: resolvedDescription,
    url: pagePath,
    siteName,
    locale: openGraphLocales[locale]
  };

  return {
    title: title ? title : { absolute: siteName },
    description: resolvedDescription,
    // Next replaces the layout's `alternates` wholesale instead of merging
    // it, so the digest feeds the layout declares are repeated here, or every
    // page with its own metadata would drop them.
    alternates: {
      canonical: pagePath,
      ...(hasEnglishTwin(path)
        ? { languages: buildLanguageAlternates(path) }
        : {}),
      types: buildFeedAlternateTypes(feeds, locale)
    },
    openGraph:
      type === "article"
        ? {
            ...openGraphBase,
            type,
            ...(publishedTime ? { publishedTime } : {})
          }
        : { ...openGraphBase, type },
    twitter: {
      card: largeImage ? "summary_large_image" : "summary",
      title: fullTitle,
      description: resolvedDescription
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {})
  };
}
