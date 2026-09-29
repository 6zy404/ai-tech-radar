import type { Metadata } from "next";

import {
  jsonFeedPath,
  rssFeedPath,
  signalFeedPath,
  weeklyReviewFeedPath
} from "@/lib/feed-paths";

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

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

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
  /** Defaults to `rss`; only the digest also has a JSON Feed. */
  format?: "rss" | "json";
}

const feedMimeTypes: Record<NonNullable<PageFeed["format"]>, string> = {
  rss: "application/rss+xml",
  json: "application/feed+json"
};

/** The digest feeds, announced on every page. */
export const siteFeeds: readonly PageFeed[] = [
  { path: rssFeedPath, title: `${siteName} · 技术简报` },
  {
    path: jsonFeedPath,
    title: `${siteName} · 技术简报（JSON）`,
    format: "json"
  }
];

/** Announced by `/digest/weekly` and `/digest/weekly/[week]`. */
export const weeklyReviewFeed: PageFeed = {
  path: weeklyReviewFeedPath,
  title: `${siteName} · 本周回顾`
};

/** Announced by every view of `/technologies`. */
export const signalFeed: PageFeed = {
  path: signalFeedPath,
  title: `${siteName} · 全部技术信号`
};

type FeedAlternateTypes = Record<string, { url: string; title: string }[]>;

/**
 * The `alternates.types` value for a page: its own feeds first, so a reader
 * that takes the first `rel="alternate"` subscribes to what the page is
 * about, then the site-wide digest feeds.
 */
export function buildFeedAlternateTypes(
  pageFeeds: readonly PageFeed[] = []
): FeedAlternateTypes {
  const types: FeedAlternateTypes = {};

  for (const feed of [...pageFeeds, ...siteFeeds]) {
    const mimeType = feedMimeTypes[feed.format ?? "rss"];
    (types[mimeType] ??= []).push({ url: feed.path, title: feed.title });
  }

  return types;
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
}

export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  noIndex = false,
  feeds = [],
  largeImage = false
}: PageMetadataInput): Metadata {
  const resolvedDescription = compactDescription(
    description ?? siteDescription
  );
  const fullTitle = title ? `${title} · ${siteName}` : siteName;

  return {
    title: title ? title : { absolute: siteName },
    description: resolvedDescription,
    // Next replaces the layout's `alternates` wholesale instead of merging
    // it, so the digest feeds the layout declares are repeated here, or every
    // page with its own metadata would drop them.
    alternates: { canonical: path, types: buildFeedAlternateTypes(feeds) },
    openGraph: {
      title: fullTitle,
      description: resolvedDescription,
      url: path,
      siteName,
      locale: "zh_CN",
      type
    },
    twitter: {
      card: largeImage ? "summary_large_image" : "summary",
      title: fullTitle,
      description: resolvedDescription
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {})
  };
}
