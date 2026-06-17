import Link from "next/link";

import type { RelationListItem } from "@/types/content";

interface RelationListProps {
  title: string;
  description?: string;
  emptyText: string;
  items: RelationListItem[];
  className?: string;
  linkLabel?: string;
  formatRelationType?: (relationType: RelationListItem["relationType"]) => string;
}

export function RelationList({
  title,
  description,
  emptyText,
  items,
  className = "",
  linkLabel,
  formatRelationType
}: RelationListProps) {
  return (
    <section className={`detail-section ${className}`.trim()}>
      <h2>{title}</h2>
      {description ? (
        <p className="relation-list__description">{description}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <ul className="relation-list">
          {items.map((item) => (
            <li key={item.id} className="relation-list__item">
              <div className="relation-list__text">
                <h3>
                  <Link href={item.href}>{item.title}</Link>
                </h3>
                <p>{item.note}</p>
                {linkLabel ? (
                  <Link className="relation-list__action" href={item.href}>
                    {linkLabel}
                  </Link>
                ) : null}
              </div>
              <span className="relation-pill">
                {formatRelationType
                  ? formatRelationType(item.relationType)
                  : item.relationType}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
