/**
 * Pure ranking for hybrid search: no model, no store, no I/O, so every rule
 * here is unit-tested and the eval script scores exactly what the page ships.
 *
 * Keyword search says *whether* a document contains the words; the embedding
 * says *how close* it is to what the reader meant. They are merged with
 * reciprocal rank fusion, which only looks at positions — the two scores are
 * on unrelated scales and neither has to be calibrated against the other.
 */

export type MatchReason = "keyword" | "semantic" | "both";

export interface RankableDocument {
  key: string;
  group: string;
  titleText: string;
  haystack: string;
}

/**
 * Keyword ranking inside one group: documents matching every term, those with
 * more terms in the title first, then original order. Title hits come first
 * because a reader who types a product name wants that product, not every
 * article that mentions it once.
 */
export function rankKeywordMatches(
  documents: RankableDocument[],
  terms: string[]
): string[] {
  if (terms.length === 0) {
    return [];
  }

  return documents
    .map((document, index) => ({ document, index }))
    .filter(({ document }) =>
      terms.every((term) => document.haystack.includes(term))
    )
    .map(({ document, index }) => ({
      key: document.key,
      index,
      titleHits: terms.filter((term) => document.titleText.includes(term))
        .length
    }))
    .sort((a, b) => b.titleHits - a.titleHits || a.index - b.index)
    .map((entry) => entry.key);
}

export interface SemanticCutoff {
  /**
   * Keep documents scoring at least this many standard deviations above the
   * mean score across the whole corpus for this query.
   */
  minZ: number;
  /** At most this many semantic results per group. */
  perGroupLimit: number;
}

/**
 * Chosen on the `tune` split of eval/search/queries.json only (see
 * eval/search/README.md).
 *
 * The cutoff is relative to each query's own score distribution rather than
 * an absolute cosine, because an absolute one was measured and does not work:
 * multilingual-e5 cosines sit in a narrow band that shifts with the query's
 * language. On the tune split the best English query topped out at 0.788
 * while an off-topic Chinese one ("今天天气怎么样") reached 0.854, so no single
 * floor admits the first and rejects the second.
 */
export const defaultSemanticCutoff: SemanticCutoff = {
  minZ: 1.75,
  perGroupLimit: 5
};

export interface ScoredDocument {
  key: string;
  group: string;
  score: number;
}

/**
 * Semantic ranking per group. The threshold is computed over *all* groups
 * together: a query about voice should not return the three least-bad
 * knowledge entries just because the knowledge group exists.
 */
export function selectSemanticMatches(
  scored: ScoredDocument[],
  cutoff: SemanticCutoff = defaultSemanticCutoff
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  if (scored.length < 2) {
    return result;
  }

  const mean =
    scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length;
  const deviation = Math.sqrt(
    scored.reduce((sum, entry) => sum + (entry.score - mean) ** 2, 0) /
      scored.length
  );

  // Floating-point sums leave a flat distribution with a deviation of ~1e-17
  // rather than 0, which would put every document "above" the mean.
  if (deviation < 1e-9) {
    return result;
  }

  const threshold = mean + cutoff.minZ * deviation;

  for (const entry of [...scored].sort((a, b) => b.score - a.score)) {
    if (entry.score < threshold) {
      break;
    }

    const list = result.get(entry.group) ?? [];

    if (list.length < cutoff.perGroupLimit) {
      list.push(entry.key);
      result.set(entry.group, list);
    }
  }

  return result;
}

export const rrfConstant = 60;

export interface FusedResult {
  key: string;
  score: number;
  matchedBy: MatchReason;
}

/**
 * Reciprocal rank fusion of one group's keyword and semantic lists. A
 * document found by both outranks one found by either alone; on a tie the
 * keyword hit wins, because an exact word match is the easier one to explain
 * to the reader.
 */
export function fuseRankings(
  keywordKeys: string[],
  semanticKeys: string[],
  k = rrfConstant
): FusedResult[] {
  const entries = new Map<
    string,
    { score: number; keyword: boolean; semantic: boolean }
  >();

  keywordKeys.forEach((key, rank) => {
    const entry = entries.get(key) ?? {
      score: 0,
      keyword: false,
      semantic: false
    };
    entry.score += 1 / (k + rank + 1);
    entry.keyword = true;
    entries.set(key, entry);
  });

  semanticKeys.forEach((key, rank) => {
    const entry = entries.get(key) ?? {
      score: 0,
      keyword: false,
      semantic: false
    };
    entry.score += 1 / (k + rank + 1);
    entry.semantic = true;
    entries.set(key, entry);
  });

  return [...entries.entries()]
    .map(([key, entry]) => ({
      key,
      score: entry.score,
      matchedBy: (entry.keyword && entry.semantic
        ? "both"
        : entry.keyword
          ? "keyword"
          : "semantic") as MatchReason
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.matchedBy !== "semantic") - Number(a.matchedBy !== "semantic")
    );
}
