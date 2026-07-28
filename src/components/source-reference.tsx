interface SourceReferenceProps {
  title?: string;
  sourceName: string;
  sourceUrl: string;
  publisherName?: string;
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
        {publisherName ? <span>{publisherName}</span> : null}
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
