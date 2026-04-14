import Link from "next/link";
import type { ReactNode } from "react";

interface ContentCardProps {
  title: string;
  summary: string;
  href: string;
  meta?: string[];
  badges?: ReactNode;
}

export function ContentCard({
  title,
  summary,
  href,
  meta = [],
  badges
}: ContentCardProps) {
  return (
    <article className="content-card">
      <div className="content-card__meta">
        {meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="content-card__body">
        <h2>
          <Link href={href}>{title}</Link>
        </h2>
        <p>{summary}</p>
      </div>
      {badges ? <div className="content-card__badges">{badges}</div> : null}
    </article>
  );
}
