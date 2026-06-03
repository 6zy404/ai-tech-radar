interface SourceReferenceProps {
  title?: string;
  sourceName: string;
  sourceUrl: string;
  publisherName?: string;
  publishDate?: string;
  linkLabel?: string;
  showUrl?: boolean;
}

export function SourceReference({
  title = "Source",
  sourceName,
  sourceUrl,
  publisherName,
  publishDate,
  linkLabel = "Open original source",
  showUrl = false
}: SourceReferenceProps) {
  return (
    <section className="source-reference">
      <p className="eyebrow user-eyebrow">{title}</p>
      <h2>{sourceName}</h2>
      <div className="source-reference__meta">
        {publisherName ? <span>{publisherName}</span> : null}
        {publishDate ? <span>{publishDate}</span> : null}
      </div>
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        {linkLabel}
      </a>
      {showUrl ? <span className="source-reference__url">{sourceUrl}</span> : null}
    </section>
  );
}
