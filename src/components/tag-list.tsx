import { TagBadge } from "@/components/tag-badge";
import type { TopicTag } from "@/types/content";

interface TagListProps {
  tags: TopicTag[];
  limit?: number;
  className?: string;
}

export function TagList({ tags, limit, className = "" }: TagListProps) {
  const visibleTags = typeof limit === "number" ? tags.slice(0, limit) : tags;
  const remainingCount =
    typeof limit === "number"
      ? Math.max(tags.length - visibleTags.length, 0)
      : 0;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={`tag-row ${className}`.trim()}>
      {visibleTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
      {remainingCount > 0 ? (
        <span className="info-pill info-pill--subtle">+{remainingCount}</span>
      ) : null}
    </div>
  );
}
