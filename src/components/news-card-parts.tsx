import Link from "next/link";

import { HighlightedText } from "@/components/highlighted-text";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";
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
  terms,
  locale = "zh"
}: {
  tags: string[];
  terms?: string[];
  locale?: Locale;
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="news-card__tags">
      {tags.map((tag) => (
        <span key={tag} lang={nameLangAttr(locale, tag)}>
          {terms ? <HighlightedText text={tag} terms={terms} /> : tag}
        </span>
      ))}
    </div>
  );
}

export function NewsCardSignalLink({
  technology,
  locale = "zh"
}: {
  technology: PublicNewsItem["publishedTechnology"];
  locale?: Locale;
}) {
  if (!technology) {
    return null;
  }

  return (
    <Link
      className="news-card__signal"
      href={localePath(locale, `/technologies/${technology.slug}`)}
    >
      {locale === "zh" ? (
        signalsCopy.zh.news.signalLink(technology.title)
      ) : (
        <>
          {signalsCopy[locale].news.signalLink("")}
          <span lang={nameLangAttr(locale, technology.title)}>
            {technology.title}
          </span>
        </>
      )}
    </Link>
  );
}
