import { normalizeAiGenerationMetadata } from "@/lib/ai-generation-record";

/**
 * The three public AI caches as `scripts/purge-mock-ai-cache.ts` reads them:
 * which file, which list inside it, and how to name a record and the
 * signals it is about. The store modules keep their own record shapes; this
 * only needs the raw store, so a record is written back byte for byte or not
 * at all.
 */
export interface AiCacheStoreDescriptor {
  fileName: string;
  listKey: "explanations" | "comparisons" | "learningPaths";
  /** 解读 / 对比 / 学习路径 — how the workspace names the feature. */
  label: string;
  keyOf(record: Record<string, unknown>): string;
  technologyIdsOf(record: Record<string, unknown>): string[];
}

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const aiCacheStores: AiCacheStoreDescriptor[] = [
  {
    fileName: "technology-explanations.json",
    listKey: "explanations",
    label: "解读",
    keyOf: (record) => asString(record.cacheKey),
    technologyIdsOf: (record) => [asString(record.technologyId)]
  },
  {
    fileName: "technology-comparisons.json",
    listKey: "comparisons",
    label: "对比",
    keyOf: (record) => asString(record.pairKey),
    technologyIdsOf: (record) => [
      asString(record.technologyIdA),
      asString(record.technologyIdB)
    ]
  },
  {
    fileName: "technology-learning-paths.json",
    listKey: "learningPaths",
    label: "学习路径",
    keyOf: (record) => asString(record.technologyId),
    technologyIdsOf: (record) => [asString(record.technologyId)]
  }
];

export interface MockAiCachePurgePlan<T> {
  /** The records to write back, in their stored order. */
  kept: T[];
  /** The records the mock provider wrote, in their stored order. */
  removed: T[];
}

/**
 * Splits a cache's records into the ones to keep and the ones the mock
 * provider wrote. The rule is the one the generators apply since 2026-10-14
 * (`isReusableCachedAiRecord`): a `mock_llm` record is never served once a
 * real model is configured — but it also never leaves the file on its own,
 * because a cache is only rewritten when that exact key is asked for again.
 * This removes it so the file says what the readers can get.
 *
 * A record without a `generationMode` is read as `mock_llm`, the same as
 * `normalizeAiGenerationMetadata` reads it for the guard. Failed records are
 * kept: the guard already treats them as absent, and they record an error
 * worth keeping.
 */
export function planMockAiCachePurge<T extends Record<string, unknown>>(
  records: T[]
): MockAiCachePurgePlan<T> {
  const kept: T[] = [];
  const removed: T[] = [];

  for (const record of records) {
    const { generationMode } = normalizeAiGenerationMetadata(record);

    (generationMode === "mock_llm" ? removed : kept).push(record);
  }

  return { kept, removed };
}
