import Link from "next/link";

import type { PublicNewsItem } from "@/lib/news";

// The two pieces every news-shaped card repeats: the 全部快讯 card, and the
// search page's news and result cards.

export function NewsCardTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="news-card__tags">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
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
