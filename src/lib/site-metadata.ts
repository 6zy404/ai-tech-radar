import type { Metadata } from "next";

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
}

export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  noIndex = false
}: PageMetadataInput): Metadata {
  const resolvedDescription = compactDescription(
    description ?? siteDescription
  );
  const fullTitle = title ? `${title} · ${siteName}` : siteName;

  return {
    title: title ? title : { absolute: siteName },
    description: resolvedDescription,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description: resolvedDescription,
      url: path,
      siteName,
      locale: "zh_CN",
      type
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description: resolvedDescription
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {})
  };
}
