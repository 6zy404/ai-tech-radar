import fs from "node:fs";
import path from "node:path";
import {
  TRIAGE_PROMPT_VERSION,
  runCandidateTriage,
  type TriageExample,
  type TriageLabel
} from "@/lib/candidate-llm-triage";
import { getImportedCandidates } from "@/lib/candidate-workflow";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";

/**
 * Stored model suggestions for undecided candidates — workspace-only.
 *
 * A regenerable cache in the same sense as the three public AI caches, so it
 * is git-ignored; under the SQLite driver it lives in `runtime_configs`, keyed
 * by file name like the two schedule configs, because it is one object rather
 * than a record list.
 *
 * Suggestions are keyed by candidate and tagged with the prompt version and
 * model that produced them. A suggestion from an older prompt is not shown as
 * current: the eval number that justifies trusting it belongs to one version.
 */

export interface StoredTriageSuggestion {
  candidateId: string;
  decision: TriageLabel;
  confidence: number;
  reason: string;
  promptVersion: string;
  /** The model that answered, as the provider reported it. */
  modelName: string;
  /**
   * The model that was asked for. Deduplication keys on this, not on
   * `modelName`: the two can differ (the mock answers under its own name),
   * and comparing the reported name made every run regenerate everything.
   */
  requestedModel: string;
  providerName: string;
  createdAt: string;
}

interface TriageSuggestionStore {
  updatedAt: string;
  suggestions: Record<string, StoredTriageSuggestion>;
}

const storePath = getLocalStoreFilePath("candidate-triage-suggestions.json");
const fewShotPath = path.join(process.cwd(), "eval", "triage", "fewshot.json");
const CONCURRENCY = 3;

function readStore(): TriageSuggestionStore {
  return readLocalJsonFile<TriageSuggestionStore>(storePath, {
    updatedAt: "",
    suggestions: {}
  });
}

/**
 * The same examples the eval uses, so the suggestion an editor sees comes from
 * the configuration that was measured. Missing file → zero-shot, which still
 * works but is not what `npm run eval:triage` reported on.
 */
function readFewShotExamples(): TriageExample[] {
  try {
    return JSON.parse(fs.readFileSync(fewShotPath, "utf8")) as TriageExample[];
  } catch {
    return [];
  }
}

export function isMockTriageModel(modelName: string): boolean {
  return modelName.startsWith("mock");
}

/** Current-version suggestions only, keyed by candidate id. */
export function getCurrentTriageSuggestions(): Map<
  string,
  StoredTriageSuggestion
> {
  const current = new Map<string, StoredTriageSuggestion>();

  for (const suggestion of Object.values(readStore().suggestions)) {
    if (suggestion.promptVersion === TRIAGE_PROMPT_VERSION) {
      current.set(suggestion.candidateId, suggestion);
    }
  }

  return current;
}

export interface TriageGenerationSummary {
  generated: number;
  failed: number;
  skipped: number;
  modelName: string;
  errors: string[];
}

/**
 * Suggest a disposition for every undecided candidate that has no suggestion
 * from the current prompt version and model yet. Changes no candidate status.
 */
export async function generateTriageSuggestionsForUndecided(): Promise<TriageGenerationSummary> {
  const provider = createConfiguredLlmProvider();
  const examples = readFewShotExamples();
  const existing = getCurrentTriageSuggestions();
  const undecided = getImportedCandidates().filter(
    (candidate) => candidate.importStatus === "new"
  );
  const pending = undecided.filter(
    (candidate) =>
      existing.get(candidate.id)?.requestedModel !== provider.modelName
  );
  const fresh: StoredTriageSuggestion[] = [];
  const errors: string[] = [];
  let next = 0;

  const lanes = Array.from({ length: CONCURRENCY }, async () => {
    while (next < pending.length) {
      const candidate = pending[next];
      next += 1;

      const result = await runCandidateTriage(
        {
          title: candidate.originalTitle,
          summary: candidate.originalSummary ?? "",
          content: candidate.originalContent ?? "",
          sourceName: candidate.sourceName,
          sourceUrl: candidate.sourceUrl,
          publisherName: candidate.publisherName,
          publishDate: candidate.publishDate
        },
        examples,
        provider
      );

      if (result.suggestion) {
        fresh.push({
          candidateId: candidate.id,
          ...result.suggestion,
          promptVersion: TRIAGE_PROMPT_VERSION,
          modelName: result.modelName,
          requestedModel: provider.modelName,
          providerName: result.providerName,
          createdAt: new Date().toISOString()
        });
      } else if (result.error) {
        errors.push(result.error);
      }
    }
  });

  await Promise.all(lanes);

  if (fresh.length > 0) {
    // Re-read before writing: generation takes seconds and another request
    // may have written in between. Merge, never replace — the lesson of the
    // 2026-07-30 PATCH that wiped 26 ids.
    const store = readStore();

    for (const suggestion of fresh) {
      store.suggestions[suggestion.candidateId] = suggestion;
    }

    store.updatedAt = new Date().toISOString();
    writeLocalJsonFile(storePath, store);
  }

  return {
    generated: fresh.length,
    failed: pending.length - fresh.length,
    skipped: undecided.length - pending.length,
    modelName: provider.modelName,
    errors: [...new Set(errors)].slice(0, 3)
  };
}
