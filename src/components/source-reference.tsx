import Link from "next/link";

import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import type { Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";

interface SourceReferenceProps {
  title?: string;
  sourceName: string;
  sourceUrl: string;
  publisherName?: string;
  /** Where the publisher name links (its /sources card); plain text without. */
  publisherHref?: string;
  publisherTypeLabel?: string;
  publishDate?: string;
  linkLabel?: string;
  showUrl?: boolean;
  locale?: Locale;
}

export function SourceReference({
  title,
  sourceName,
  sourceUrl,
  publisherName,
  publisherHref,
  publisherTypeLabel,
  publishDate,
  linkLabel,
  showUrl = false,
  locale = "zh"
}: SourceReferenceProps) {
  const copy = technologyDetailCopy[locale].source;
  const publisherLang = publisherName
    ? nameLangAttr(locale, publisherName)
    : undefined;

  return (
    <section className="source-reference">
      <p className="eyebrow user-eyebrow">{title ?? copy.title}</p>
      <h2 lang={nameLangAttr(locale, sourceName)}>{sourceName}</h2>
      <div className="source-reference__meta">
        {publisherName ? (
          publisherHref ? (
            <Link
              href={publisherHref}
              className="source-reference__publisher"
              lang={publisherLang}
            >
              {publisherName}
            </Link>
          ) : (
            <span lang={publisherLang}>{publisherName}</span>
          )
        ) : null}
        {publisherTypeLabel ? (
          <span className="source-reference__publisher-type">
            {publisherTypeLabel}
          </span>
        ) : null}
        {publishDate ? <span>{publishDate}</span> : null}
      </div>
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        {linkLabel ?? copy.linkLabel}
      </a>
      {showUrl ? (
        <span className="source-reference__url">{sourceUrl}</span>
      ) : null}
    </section>
  );
}
