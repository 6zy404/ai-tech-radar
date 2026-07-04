import Link from "next/link";

import type { RelationListItem } from "@/types/content";

interface RelatedItemsSectionProps {
  title: string;
  description?: string;
  emptyText: string;
  items: RelationListItem[];
  linkLabel?: string;
  formatRelationType?: (
    relationType: RelationListItem["relationType"]
  ) => string;
}

export function RelatedItemsSection({
  title,
  description,
  items,
  linkLabel = "查看相关信号",
  formatRelationType
}: RelatedItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="user-related-section" aria-label={title}>
      <div className="user-related-section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="user-related-section__list">
        {items.map((item) => (
          <article
            className="user-related-section__item"
            key={`${item.id}-${item.relationType}`}
          >
            <div className="user-related-section__body">
              <h3>{item.title}</h3>
              <p>{item.note}</p>
            </div>
            <div className="user-related-section__meta">
              <span className="user-related-section__relation">
                {formatRelationType
                  ? formatRelationType(item.relationType)
                  : item.relationType}
              </span>
              <Link className="user-related-section__link" href={item.href}>
                {linkLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
