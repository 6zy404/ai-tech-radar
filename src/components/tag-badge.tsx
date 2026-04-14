import type { TopicTag } from "@/types/content";

interface TagBadgeProps {
  tag: TopicTag;
}

export function TagBadge({ tag }: TagBadgeProps) {
  return <span className="tag-badge">{tag.name}</span>;
}
