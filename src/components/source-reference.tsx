import Link from "next/link";

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
}

export function SourceReference({
  title = "来源",
  sourceName,
  sourceUrl,
  publisherName,
  publisherHref,
  publisherTypeLabel,
  publishDate,
  linkLabel = "打开原始来源",
  showUrl = false
}: SourceReferenceProps) {
  return (
    <section className="source-reference">
      <p className="eyebrow user-eyebrow">{title}</p>
      <h2>{sourceName}</h2>
      <div className="source-reference__meta">
        {publisherName ? (
          publisherHref ? (
            <Link href={publisherHref} className="source-reference__publisher">
              {publisherName}
            </Link>
          ) : (
            <span>{publisherName}</span>
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
        {linkLabel}
      </a>
      {showUrl ? (
        <span className="source-reference__url">{sourceUrl}</span>
      ) : null}
    </section>
  );
}
