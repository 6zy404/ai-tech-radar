import { RelationList } from "@/components/relation-list";
import type { RelationListItem } from "@/types/content";

interface RelatedItemsSectionProps {
  title: string;
  description?: string;
  emptyText: string;
  items: RelationListItem[];
  formatRelationType?: (relationType: RelationListItem["relationType"]) => string;
}

export function RelatedItemsSection({
  title,
  description,
  emptyText,
  items,
  formatRelationType
}: RelatedItemsSectionProps) {
  return (
    <RelationList
      title={title}
      description={description}
      emptyText={emptyText}
      items={items}
      className="user-related-section"
      formatRelationType={formatRelationType}
    />
  );
}
