import { getContentGraph, type ContentGraphEdge } from "@/lib/content";

/**
 * How much of the content graph carries the fallback relation 关联
 * (`related-to`), as a whole percentage. /about quotes it; until 2026-10-14
 * the page said 「约 12%」 by hand, which went stale the day the fallback
 * edges were typed (18.1% → 6.1%, 2026-10-12). Counted over the same edges
 * /network draws, so the two never disagree.
 */
export function computeFallbackRelationPercent(
  edges: readonly Pick<ContentGraphEdge, "relationType">[]
): number {
  if (edges.length === 0) {
    return 0;
  }

  const fallback = edges.filter(
    (edge) => edge.relationType === "related-to"
  ).length;

  return Math.round((fallback / edges.length) * 100);
}

export function getFallbackRelationPercent(): number {
  return computeFallbackRelationPercent(getContentGraph().edges);
}
