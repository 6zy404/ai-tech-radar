import type { ContentKind, RelationType } from "@/types/content";

/**
 * Which way a stored relation points, seen from the entity being edited:
 * `outgoing` stores the edited entity as `from`, `incoming` stores the
 * target as `from`. Only `requires` (必备) reads it — `from` needs `to`
 * first — so the editors show it for that type alone.
 */
export type RelationDirection = "outgoing" | "incoming";

/**
 * Shared shape for prefilling the workspace relation editors: the current
 * (merged seed + workspace override) relation value per related-content
 * option. Pure module — safe to import from both server pages and client
 * form components.
 */
export interface RelationDefault {
  relationType: RelationType;
  note?: string;
  /** The stored direction; absent means `outgoing`. */
  direction?: RelationDirection;
}

/** Keyed by `getRelationDefaultKey(targetType, targetId)`. */
export type RelationDefaultsMap = Record<string, RelationDefault>;

export function getRelationDefaultKey(
  targetType: ContentKind,
  targetId: string
): string {
  return `${targetType}:${targetId}`;
}
