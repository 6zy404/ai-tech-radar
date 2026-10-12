import { getImportedCandidates } from "@/lib/candidate-workflow";
import { embedPassages } from "@/lib/embeddings";
import {
  saveSemanticDedupResult,
  saveSemanticDedupRun,
  type SemanticDedupRunStatus,
  type SemanticDedupRunSummary
} from "@/lib/semantic-dedup-store";
import {
  CANDIDATE_VECTOR_CACHE_FILE,
  buildCandidateDedupText,
  buildSignalDedupTexts,
  findSemanticCandidatePairs,
  findSemanticPublishedMatches
} from "@/lib/semantic-dedup";
import { getPublishedTechnologyWorkspaceRecords } from "@/lib/technology-draft-workflow";

/**
 * Recomputes the semantic matches for the current candidate pool. Runs after
 * an import — by the task runner, awaited with a deadline, and in the
 * background after a workspace import.
 *
 * It must never hold an import up. If the model is not ready by the deadline
 * the run is recorded as a timeout and the stored matches are left as they
 * were, so duplicate groups fall back to the deterministic rules plus whatever
 * the last successful run found. A model that finishes loading after the
 * deadline still fills the vector cache, which makes the next run fast.
 */

const defaultTimeoutMs = 60_000;

function getTimeoutMs(): number {
  const value = Number(process.env.SEMANTIC_DEDUP_TIMEOUT_MS);

  return Number.isFinite(value) && value > 0 ? value : defaultTimeoutMs;
}

let inFlight: Promise<SemanticDedupRunSummary> | undefined;

async function computeAndSave(
  startedAt: Date,
  isAbandoned: () => boolean
): Promise<Omit<SemanticDedupRunSummary, "durationMs" | "finishedAt">> {
  const candidates = getImportedCandidates();
  const signals = getPublishedTechnologyWorkspaceRecords();
  const candidateVectors = await embedPassages(
    candidates.map((candidate) =>
      buildCandidateDedupText(
        candidate.originalTitle,
        candidate.originalSummary
      )
    ),
    { cacheFile: CANDIDATE_VECTOR_CACHE_FILE }
  );
  const signalTexts = signals.map((signal) => buildSignalDedupTexts(signal));
  const flatSignalVectors = await embedPassages(
    signalTexts.flatMap((texts) => texts.map((text) => text.text)),
    { cacheFile: CANDIDATE_VECTOR_CACHE_FILE }
  );
  const dedupCandidates = candidates.map((candidate, index) => ({
    id: candidate.id,
    publishDate: candidate.publishDate,
    isRelease: candidate.sourceType === "github-release",
    vector: candidateVectors[index],
    convertedTechnologyId: candidate.convertedTechnologyId
  }));
  let offset = 0;
  const dedupSignals = signals.map((signal, index) => {
    const vectors = flatSignalVectors.slice(
      offset,
      offset + signalTexts[index].length
    );
    offset += signalTexts[index].length;

    return {
      id: signal.id,
      title: signal.title.zh || signal.title.original,
      publishDate: signal.publishDate,
      sourceCandidateId: signal.sourceCandidateId,
      vectors
    };
  });
  const candidatePairs = findSemanticCandidatePairs(dedupCandidates);
  const publishedMatches = findSemanticPublishedMatches(
    dedupCandidates,
    dedupSignals
  );
  const summary = {
    startedAt: startedAt.toISOString(),
    status: "success" as const,
    candidateCount: candidates.length,
    candidatePairCount: candidatePairs.length,
    publishedMatchCount: publishedMatches.length,
    message: ""
  };

  if (!isAbandoned()) {
    const finishedAt = new Date();

    saveSemanticDedupResult({
      coveredCandidateIds: candidates.map((candidate) => candidate.id),
      candidatePairs,
      publishedMatches,
      run: {
        ...summary,
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        message: buildSemanticDedupMessage({
          ...summary,
          durationMs: finishedAt.getTime() - startedAt.getTime()
        })
      }
    });
  }

  return summary;
}

export function buildSemanticDedupMessage(
  run: Pick<
    SemanticDedupRunSummary,
    | "status"
    | "durationMs"
    | "candidateCount"
    | "candidatePairCount"
    | "publishedMatchCount"
  > & { message?: string }
): string {
  const seconds = (run.durationMs / 1000).toFixed(1);

  if (run.status === "timeout") {
    return `语义去重：${seconds} 秒内模型未就绪，本次只用确定性规则，保留上次的语义匹配。`;
  }

  if (run.status === "failed") {
    return `语义去重失败（${run.message || "未知错误"}），本次只用确定性规则。`;
  }

  return `语义去重：候选 ${run.candidateCount} 条，语义同组 ${run.candidatePairCount} 对，疑似已发布 ${run.publishedMatchCount} 条，用时 ${seconds} 秒。`;
}

async function run(timeoutMs: number): Promise<SemanticDedupRunSummary> {
  const startedAt = new Date();
  let abandoned = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const work = computeAndSave(startedAt, () => abandoned);
  let status: SemanticDedupRunStatus = "success";
  let message = "";
  let partial:
    Omit<SemanticDedupRunSummary, "durationMs" | "finishedAt"> | undefined;

  // A late failure of abandoned work has nobody to report to; keep it quiet.
  work.catch(() => undefined);

  try {
    const outcome = await Promise.race([work, deadline]);

    if (outcome === "timeout") {
      abandoned = true;
      status = "timeout";
    } else {
      partial = outcome;
    }
  } catch (error) {
    status = "failed";
    message = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timer);
  }

  const finishedAt = new Date();
  const summary: SemanticDedupRunSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status,
    candidateCount: partial?.candidateCount ?? 0,
    candidatePairCount: partial?.candidatePairCount ?? 0,
    publishedMatchCount: partial?.publishedMatchCount ?? 0,
    message
  };

  summary.message = buildSemanticDedupMessage(summary);

  if (status !== "success") {
    try {
      saveSemanticDedupRun(summary);
    } catch {
      // Recording the miss is a convenience; the import already succeeded.
    }
  }

  return summary;
}

/**
 * One run per process at a time: a second caller while one is going gets the
 * same result instead of loading the model twice.
 */
export function refreshSemanticDuplicateMatches(
  options: { timeoutMs?: number } = {}
): Promise<SemanticDedupRunSummary> {
  if (!inFlight) {
    inFlight = run(options.timeoutMs ?? getTimeoutMs()).finally(() => {
      inFlight = undefined;
    });
  }

  return inFlight;
}

/** For the workspace import routes: start it, answer the request, log the outcome. */
export function refreshSemanticDuplicateMatchesInBackground(): void {
  void refreshSemanticDuplicateMatches()
    .then((summary) => {
      if (summary.status !== "success") {
        console.warn(`[semantic-dedup] ${summary.message}`);
      }
    })
    .catch((error) => {
      console.warn("[semantic-dedup] refresh failed:", error);
    });
}
