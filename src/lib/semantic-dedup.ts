/**
 * Semantic duplicate detection for imported candidates — the pure half.
 *
 * The deterministic rules in `candidate-duplicate-rules.ts` compare URLs and
 * latin title tokens, so they cannot see two Chinese headlines about the same
 * event, nor a 量子位 piece and an InfoQ piece reporting one announcement in
 * different words. This module compares "title + summary" vectors from the
 * local embedding model instead. No model, disk or store access here: vectors
 * are passed in, so the rules can be tested with fake ones.
 *
 * The thresholds are measured, not chosen — see `eval/dedup/README.md` and
 * `scripts/measure-semantic-dedup.ts`.
 */

/** Under `.cache/`, separate from search's vectors. */
export const CANDIDATE_VECTOR_CACHE_FILE = "candidate-embeddings.json";

/**
 * Bumped whenever a threshold or an exclusion below changes. A stored match
 * made under another version (or another model) is treated as absent.
 */
export const SEMANTIC_DEDUP_RULE_VERSION = "semantic-dedup-v1";

export const SEMANTIC_DEDUP_RULES = {
  candidateThreshold: 0.96,
  publishedThreshold: 0.92,
  maxDayDistance: 3
} as const;

/** Summary characters that go into the vector; the title always goes in whole. */
const SUMMARY_LIMIT = 300;

export type DedupLanguage = "zh" | "en";

function toPlainText(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text a candidate is embedded as: its title, then its summary. */
export function buildCandidateDedupText(
  title: string,
  summary?: string
): string {
  const cleanTitle = toPlainText(title);
  const cleanSummary = toPlainText(summary).slice(0, SUMMARY_LIMIT);

  return cleanSummary && cleanSummary !== cleanTitle
    ? `${cleanTitle}\n${cleanSummary}`
    : cleanTitle;
}

/** A headline with any Chinese in it is a Chinese headline. */
export function getDedupLanguage(title: string): DedupLanguage {
  return /[一-鿿]/.test(title) ? "zh" : "en";
}

/**
 * A published signal is embedded twice when it has a Chinese version: once as
 * its original and once in Chinese. A candidate is matched against the closer
 * of the two, so a Chinese report of an English announcement meets the
 * signal's Chinese text instead of crossing languages — which this model does
 * badly (eval/dedup/README.md).
 */
export function buildSignalDedupTexts(signal: {
  title: { original: string; zh?: string };
  summary: { original: string; zh?: string };
}): { text: string; language: DedupLanguage }[] {
  const texts = [
    {
      text: buildCandidateDedupText(
        signal.title.original,
        signal.summary.original
      ),
      language: getDedupLanguage(signal.title.original)
    }
  ];

  if (signal.title.zh && signal.title.zh !== signal.title.original) {
    texts.push({
      text: buildCandidateDedupText(signal.title.zh, signal.summary.zh),
      language: "zh"
    });
  }

  return texts;
}

/** Vectors are normalized, so the dot product is the cosine. */
export function cosineSimilarity(left: number[], right: number[]): number {
  let sum = 0;

  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

export function getDayDistance(leftDate: string, rightDate: string): number {
  const left = Date.parse(leftDate);
  const right = Date.parse(rightDate);

  if (Number.isNaN(left) || Number.isNaN(right)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(left - right) / (1000 * 60 * 60 * 24);
}

export interface SemanticDedupCandidate {
  id: string;
  publishDate: string;
  /**
   * Release-feed items never take part. Their bodies are release notes, so
   * `v0.31.0` and `v0.30.0` of one project read alike while being different
   * releases; an exact re-import is already caught by its URL.
   */
  isRelease: boolean;
  vector: number[];
  /** The signal this candidate itself became — matching it is not news. */
  convertedTechnologyId?: string;
}

export interface SemanticDedupSignal {
  id: string;
  title: string;
  publishDate: string;
  sourceCandidateId?: string;
  /** One per text from `buildSignalDedupTexts`; the closest one counts. */
  vectors: number[][];
}

export interface SemanticCandidatePair {
  leftId: string;
  rightId: string;
  score: number;
}

export interface SemanticPublishedMatchResult {
  candidateId: string;
  technologyId: string;
  technologyTitle: string;
  score: number;
}

/** Candidate pairs that read as the same item: grouped as duplicates. */
export function findSemanticCandidatePairs(
  candidates: SemanticDedupCandidate[]
): SemanticCandidatePair[] {
  const pairs: SemanticCandidatePair[] = [];
  const eligible = candidates.filter((candidate) => !candidate.isRelease);

  for (let left = 0; left < eligible.length; left += 1) {
    for (let right = left + 1; right < eligible.length; right += 1) {
      if (
        getDayDistance(
          eligible[left].publishDate,
          eligible[right].publishDate
        ) > SEMANTIC_DEDUP_RULES.maxDayDistance
      ) {
        continue;
      }

      const score = cosineSimilarity(
        eligible[left].vector,
        eligible[right].vector
      );

      if (score >= SEMANTIC_DEDUP_RULES.candidateThreshold) {
        const [leftId, rightId] = [
          eligible[left].id,
          eligible[right].id
        ].sort();
        pairs.push({ leftId, rightId, score });
      }
    }
  }

  return pairs;
}

/**
 * For each candidate, the published signal it reads most like, when that
 * clears the threshold. Advisory only: it raises `similar_to_published`,
 * which nothing rejects on — measured precision at this threshold is about
 * half (eval/dedup/README.md), so an editor decides.
 */
export function findSemanticPublishedMatches(
  candidates: SemanticDedupCandidate[],
  signals: SemanticDedupSignal[]
): SemanticPublishedMatchResult[] {
  const matches: SemanticPublishedMatchResult[] = [];

  for (const candidate of candidates) {
    if (candidate.isRelease) {
      continue;
    }

    let best: SemanticPublishedMatchResult | undefined;

    for (const signal of signals) {
      if (
        signal.id === candidate.convertedTechnologyId ||
        signal.sourceCandidateId === candidate.id ||
        getDayDistance(candidate.publishDate, signal.publishDate) >
          SEMANTIC_DEDUP_RULES.maxDayDistance
      ) {
        continue;
      }

      const score = Math.max(
        ...signal.vectors.map((vector) =>
          cosineSimilarity(candidate.vector, vector)
        )
      );

      if (
        score >= SEMANTIC_DEDUP_RULES.publishedThreshold &&
        (!best || score > best.score)
      ) {
        best = {
          candidateId: candidate.id,
          technologyId: signal.id,
          technologyTitle: signal.title,
          score
        };
      }
    }

    if (best) {
      matches.push(best);
    }
  }

  return matches;
}
