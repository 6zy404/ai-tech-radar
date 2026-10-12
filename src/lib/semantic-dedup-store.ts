import { EMBEDDING_MODEL } from "@/lib/embeddings";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import {
  SEMANTIC_DEDUP_RULES,
  SEMANTIC_DEDUP_RULE_VERSION,
  type SemanticCandidatePair,
  type SemanticPublishedMatchResult
} from "@/lib/semantic-dedup";
import type { SemanticPublishedMatch } from "@/types/content";

/**
 * Stored semantic matches — workspace-only.
 *
 * Duplicate groups are derived synchronously on every read
 * (`getCandidateWorkflowData`), while vectors come from an async model, so the
 * matches are computed after an import (`semantic-dedup-refresh.ts`) and kept
 * here for the synchronous read. Regenerable like the triage suggestions, so
 * git-ignored; under the SQLite driver it is one `runtime_configs` row.
 *
 * Every entry records the model, rule version and threshold that produced it.
 * An entry made under any other is treated as absent, so changing a threshold
 * can never leave groups standing that the new threshold would not form.
 */

export const SEMANTIC_MATCH_STORE_FILE = "candidate-semantic-matches.json";

interface MatchProvenance {
  model: string;
  ruleVersion: string;
  threshold: number;
  computedAt: string;
}

export type StoredSemanticCandidatePair = SemanticCandidatePair &
  MatchProvenance;

export type StoredSemanticPublishedMatch = SemanticPublishedMatchResult &
  MatchProvenance;

export type SemanticDedupRunStatus = "success" | "timeout" | "failed";

export interface SemanticDedupRunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: SemanticDedupRunStatus;
  candidateCount: number;
  candidatePairCount: number;
  publishedMatchCount: number;
  message: string;
}

export interface SemanticMatchStore {
  updatedAt: string;
  candidatePairs: StoredSemanticCandidatePair[];
  publishedMatches: Record<string, StoredSemanticPublishedMatch>;
  lastRun?: SemanticDedupRunSummary;
}

/** Entries older than this are dropped on write; the snapshot window is shorter. */
const RETENTION_DAYS = 30;

// Resolved per call, so a changed LOCAL_DATA_DIR (tests, validators) is honoured.
const storePath = () => getLocalStoreFilePath(SEMANTIC_MATCH_STORE_FILE);

function readStore(): SemanticMatchStore {
  const store = readLocalJsonFile<Partial<SemanticMatchStore>>(storePath(), {});

  return {
    updatedAt: store.updatedAt ?? "",
    candidatePairs: store.candidatePairs ?? [],
    publishedMatches: store.publishedMatches ?? {},
    lastRun: store.lastRun
  };
}

function isCurrent(entry: MatchProvenance, threshold: number): boolean {
  return (
    entry.model === EMBEDDING_MODEL &&
    entry.ruleVersion === SEMANTIC_DEDUP_RULE_VERSION &&
    entry.threshold === threshold
  );
}

/** Candidate pairs under the current model and rules. */
export function getSemanticCandidatePairs(): StoredSemanticCandidatePair[] {
  return readStore().candidatePairs.filter((pair) =>
    isCurrent(pair, SEMANTIC_DEDUP_RULES.candidateThreshold)
  );
}

/** Published-signal matches under the current model and rules, by candidate. */
export function getSemanticPublishedMatches(): Map<
  string,
  SemanticPublishedMatch
> {
  const matches = new Map<string, SemanticPublishedMatch>();

  for (const match of Object.values(readStore().publishedMatches)) {
    if (isCurrent(match, SEMANTIC_DEDUP_RULES.publishedThreshold)) {
      matches.set(match.candidateId, {
        technologyId: match.technologyId,
        technologyTitle: match.technologyTitle,
        score: match.score
      });
    }
  }

  return matches;
}

export function getLastSemanticDedupRun(): SemanticDedupRunSummary | undefined {
  return readStore().lastRun;
}

/**
 * Pure merge, exported for tests. A run speaks for the candidates it covered:
 * their old entries are replaced by its results. Entries about candidates it
 * did not see are kept — the task runner and the server both write this file,
 * and a run that started from an older snapshot must not erase what a newer
 * one found.
 */
export function mergeSemanticMatchStore(
  previous: SemanticMatchStore,
  result: {
    coveredCandidateIds: string[];
    candidatePairs: SemanticCandidatePair[];
    publishedMatches: SemanticPublishedMatchResult[];
    run: SemanticDedupRunSummary;
  }
): SemanticMatchStore {
  const covered = new Set(result.coveredCandidateIds);
  const computedAt = result.run.finishedAt;
  const cutoff =
    Date.parse(computedAt) - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const fresh = (entry: MatchProvenance) =>
    Date.parse(entry.computedAt) >= cutoff;
  const provenance = (threshold: number): MatchProvenance => ({
    model: EMBEDDING_MODEL,
    ruleVersion: SEMANTIC_DEDUP_RULE_VERSION,
    threshold,
    computedAt
  });
  const publishedMatches: Record<string, StoredSemanticPublishedMatch> = {};

  for (const [candidateId, match] of Object.entries(
    previous.publishedMatches
  )) {
    if (!covered.has(candidateId) && fresh(match)) {
      publishedMatches[candidateId] = match;
    }
  }

  for (const match of result.publishedMatches) {
    publishedMatches[match.candidateId] = {
      ...match,
      ...provenance(SEMANTIC_DEDUP_RULES.publishedThreshold)
    };
  }

  return {
    updatedAt: computedAt,
    candidatePairs: [
      ...previous.candidatePairs.filter(
        (pair) =>
          !covered.has(pair.leftId) && !covered.has(pair.rightId) && fresh(pair)
      ),
      ...result.candidatePairs.map((pair) => ({
        ...pair,
        ...provenance(SEMANTIC_DEDUP_RULES.candidateThreshold)
      }))
    ],
    publishedMatches,
    lastRun: result.run
  };
}

/** Re-reads the store and merges, so a concurrent writer's entries survive. */
export function saveSemanticDedupResult(
  result: Parameters<typeof mergeSemanticMatchStore>[1]
): void {
  writeLocalJsonFile(storePath(), mergeSemanticMatchStore(readStore(), result));
}

/** Records a run that produced no matches (timeout, failure) without touching them. */
export function saveSemanticDedupRun(run: SemanticDedupRunSummary): void {
  writeLocalJsonFile(storePath(), { ...readStore(), lastRun: run });
}
