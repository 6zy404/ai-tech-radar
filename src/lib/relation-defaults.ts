import type { ContentKind, RelationType } from "@/types/content";

/**
 * Shared shape for prefilling the workspace relation editors: the current
 * (merged seed + workspace override) relation value per related-content
 * option. Pure module — safe to import from both server pages and client
 * form components.
 */
export interface RelationDefault {
  relationType: RelationType;
  note?: string;
}

/** Keyed by `getRelationDefaultKey(targetType, targetId)`. */
export type RelationDefaultsMap = Record<string, RelationDefault>;

export function getRelationDefaultKey(
  targetType: ContentKind,
  targetId: string
): string {
  return `${targetType}:${targetId}`;
}
