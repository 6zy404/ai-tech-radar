import Link from "next/link";

import type { RelationListItem } from "@/types/content";

interface RelationListProps {
  title: string;
  emptyText: string;
  items: RelationListItem[];
}

export function RelationList({ title, emptyText, items }: RelationListProps) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <ul className="relation-list">
          {items.map((item) => (
            <li key={item.id} className="relation-list__item">
              <div>
                <h3>
                  <Link href={item.href}>{item.title}</Link>
                </h3>
                <p>{item.note}</p>
              </div>
              <span className="relation-pill">{item.relationType}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
