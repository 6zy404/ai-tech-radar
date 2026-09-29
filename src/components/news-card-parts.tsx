import Link from "next/link";

import { HighlightedText } from "@/components/highlighted-text";
import type { PublicNewsItem } from "@/lib/news";

// The two pieces every news-shaped card repeats: the 全部快讯 card, and the
// search page's news and result cards.

/**
 * `terms` marks literal hits of a search query inside the tag names. Only the
 * search page passes it: keyword search matches tag names too, so without it
 * a result found through its tag showed no mark anywhere on the card.
 */
export function NewsCardTags({
  tags,
  terms
}: {
  tags: string[];
  terms?: string[];
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="news-card__tags">
      {tags.map((tag) => (
        <span key={tag}>
          {terms ? <HighlightedText text={tag} terms={terms} /> : tag}
        </span>
      ))}
    </div>
  );
}

export function NewsCardSignalLink({
  technology
}: {
  technology: PublicNewsItem["publishedTechnology"];
}) {
  if (!technology) {
    return null;
  }

  return (
    <Link
      className="news-card__signal"
      href={`/technologies/${technology.slug}`}
    >
      已收录为精选技术信号：{technology.title}
    </Link>
  );
}
