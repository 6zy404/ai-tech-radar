import { compactText } from "@/lib/compact-text";
import { cosine } from "@/lib/embeddings";
import {
  getIndexedCorpusWithinTimeout,
  type IndexedCorpus
} from "@/lib/hybrid-search";

/**
 * 「内容相近的信号」: for one published signal, the other published signals
 * whose text sits closest to it in the search embedding space. A pure derived
 * view — the vectors are the ones search already keeps in
 * `.cache/search-embeddings.json`, nothing is persisted and no LLM is called.
 *
 * Two measured decisions, both from the 91-signal pool on 2026-09-29:
 *
 * - **Similarity is taken after subtracting the pool's mean vector.** Raw e5
 *   cosines between signals sit in a band from 0.82 to 0.95 (mean 0.881,
 *   standard deviation 0.016), because every signal shares the same "AI /
 *   agents" direction. On raw scores a couple of generic items won everywhere:
 *   one agent-security write-up was the nearest neighbour of 8 unrelated
 *   signals. Centering removes the shared direction and the hubs with it.
 * - **The floor is relative to the pool, not a fixed cosine.** A pair must
 *   score at least `minZ` standard deviations above the mean of all pairwise
 *   centered scores. Recomputed per corpus, so it follows the pool as it grows.
 *   A per-signal z was tried first and rejected: every row has a tail, so a
 *   signal with no real neighbour still got its three least-bad ones.
 */

export interface SimilarSignalCutoff {
  /** Standard deviations above the mean pairwise centered similarity. */
  minZ: number;
  /** At most this many signals. */
  limit: number;
}

export const defaultSimilarSignalCutoff: SimilarSignalCutoff = {
  minZ: 2.5,
  limit: 3
};

export interface EmbeddedSignal {
  id: string;
  vector: number[];
}

export interface ScoredSignal {
  id: string;
  score: number;
}

function normalize(vector: number[]): number[] {
  const length = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0)
  );

  return length > 0 ? vector.map((value) => value / length) : vector;
}

/** Subtract the mean vector, then re-normalize so the dot product is a cosine. */
export function centerVectors(vectors: number[][]): number[][] {
  if (vectors.length === 0) {
    return [];
  }

  const dimensions = vectors[0].length;
  const mean = new Array<number>(dimensions).fill(0);

  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) {
      mean[index] += vector[index] / vectors.length;
    }
  }

  return vectors.map((vector) =>
    normalize(vector.map((value, index) => value - mean[index]))
  );
}

export interface CenteredPool {
  ids: string[];
  vectors: number[][];
  /** Mean and standard deviation of every unordered pair's score. */
  mean: number;
  deviation: number;
}

export function buildCenteredPool(signals: EmbeddedSignal[]): CenteredPool {
  const vectors = centerVectors(signals.map((signal) => signal.vector));
  const scores: number[] = [];

  for (let a = 0; a < vectors.length; a += 1) {
    for (let b = a + 1; b < vectors.length; b += 1) {
      scores.push(cosine(vectors[a], vectors[b]));
    }
  }

  const mean =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  const deviation =
    scores.length > 0
      ? Math.sqrt(
          scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) /
            scores.length
        )
      : 0;

  return { ids: signals.map((signal) => signal.id), vectors, mean, deviation };
}

/**
 * The signals most similar to `currentId`, skipping `excludeIds` (the ones the
 * page already shows as editor links or as the release line), above the pool
 * floor, best first. Empty when nothing clears the floor — the section is
 * omitted rather than filled with the least-bad matches.
 */
export function selectSimilarSignals(
  pool: CenteredPool,
  currentId: string,
  excludeIds: Iterable<string> = [],
  cutoff: SimilarSignalCutoff = defaultSimilarSignalCutoff
): ScoredSignal[] {
  const currentIndex = pool.ids.indexOf(currentId);

  // A flat pool (one signal, or identical vectors) has no meaningful floor.
  if (currentIndex < 0 || pool.deviation < 1e-9) {
    return [];
  }

  const excluded = new Set(excludeIds);
  excluded.add(currentId);
  const threshold = pool.mean + cutoff.minZ * pool.deviation;
  const current = pool.vectors[currentIndex];

  return pool.ids
    .map((id, index) => ({ id, score: cosine(current, pool.vectors[index]) }))
    .filter((entry) => !excluded.has(entry.id) && entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, cutoff.limit);
}

export interface SimilarSignalLink {
  id: string;
  title: string;
  href: string;
  summary?: string;
}

// The card shows a one-line gist, shorter than the search result summary.
const maxSummaryLength = 80;

const poolByCorpus = new WeakMap<IndexedCorpus, CenteredPool>();

function getTechnologyPool(corpus: IndexedCorpus): CenteredPool {
  let pool = poolByCorpus.get(corpus);

  if (!pool) {
    pool = buildCenteredPool(
      corpus.documents.flatMap((document, index) =>
        document.group === "technologies"
          ? [{ id: document.link.key, vector: corpus.vectors[index] }]
          : []
      )
    );
    poolByCorpus.set(corpus, pool);
  }

  return pool;
}

/**
 * For the detail page. Never makes the page wait for the model: when the
 * corpus is not ready within the search timeout (first download, a failed
 * load, a newly published signal still being embedded) it returns nothing and
 * the page renders without the section.
 */
export async function getSimilarSignals(
  technologyId: string,
  excludeIds: Iterable<string> = [],
  loadCorpus: () => Promise<IndexedCorpus> = getIndexedCorpusWithinTimeout
): Promise<SimilarSignalLink[]> {
  let corpus: IndexedCorpus;

  try {
    corpus = await loadCorpus();
  } catch (error) {
    console.warn(
      "[similar-signals] embeddings not ready, section omitted:",
      error instanceof Error ? error.message : error
    );
    return [];
  }

  const links = new Map(
    corpus.documents
      .filter((document) => document.group === "technologies")
      .map((document) => [document.link.key, document.link])
  );

  return selectSimilarSignals(
    getTechnologyPool(corpus),
    technologyId,
    excludeIds
  ).flatMap(({ id }) => {
    const link = links.get(id);

    return link
      ? [
          {
            id,
            title: link.title,
            href: link.href,
            summary: link.summary
              ? compactText(link.summary, maxSummaryLength)
              : undefined
          }
        ]
      : [];
  });
}
