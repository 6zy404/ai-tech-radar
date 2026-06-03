import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import type {
  EditorialEnrichmentSuggestion,
  EditorialEnrichmentSuggestionStatus
} from "@/types/content";

interface EditorialEnrichmentSuggestionStore {
  updatedAt: string;
  suggestions: EditorialEnrichmentSuggestion[];
}

export interface EditorialEnrichmentReadinessState {
  hasSuggestion: boolean;
  hasUnreviewedSuggestion: boolean;
  latestStatus?: EditorialEnrichmentSuggestionStatus;
}

const storePath = getLocalStoreFilePath("editorial-enrichment-suggestions.json");

function getTimestamp(): string {
  return new Date().toISOString();
}

function getDefaultStore(): EditorialEnrichmentSuggestionStore {
  return {
    updatedAt: getTimestamp(),
    suggestions: []
  };
}

function normalizeSuggestion(
  suggestion: EditorialEnrichmentSuggestion
): EditorialEnrichmentSuggestion {
  const timestamp = getTimestamp();

  return {
    ...suggestion,
    status: suggestion.status ?? "draft",
    generatedFields: suggestion.generatedFields ?? {},
    sourceInputs: {
      ...suggestion.sourceInputs,
      tags: suggestion.sourceInputs?.tags ?? [],
      priorityReasons: suggestion.sourceInputs?.priorityReasons ?? [],
      relatedKnowledge: suggestion.sourceInputs?.relatedKnowledge ?? [],
      relatedSkills: suggestion.sourceInputs?.relatedSkills ?? [],
      inputSignature: suggestion.sourceInputs?.inputSignature ?? ""
    },
    generationMode: suggestion.generationMode ?? "rule_based",
    promptVersionId: suggestion.promptVersionId,
    promptVersion: suggestion.promptVersion,
    outputValidationStatus:
      suggestion.outputValidationStatus ??
      (suggestion.generationError ? "failed" : "not_applicable"),
    outputValidationWarnings: suggestion.outputValidationWarnings ?? [],
    limitations: suggestion.limitations ?? [],
    reviewStatus: suggestion.reviewStatus ?? "unreviewed",
    qualityLabels: suggestion.qualityLabels ?? [],
    appliedFields: suggestion.appliedFields ?? [],
    createdAt: suggestion.createdAt ?? timestamp,
    updatedAt: suggestion.updatedAt ?? timestamp
  };
}

function readStore(): EditorialEnrichmentSuggestionStore {
  const store = readLocalJsonFile<EditorialEnrichmentSuggestionStore>(
    storePath,
    getDefaultStore()
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    suggestions: (store.suggestions ?? [])
      .map((suggestion) => normalizeSuggestion(suggestion))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  };
}

function writeStore(store: EditorialEnrichmentSuggestionStore): void {
  writeLocalJsonFile(storePath, {
    updatedAt: getTimestamp(),
    suggestions: store.suggestions
      .map((suggestion) => normalizeSuggestion(suggestion))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  });
}

export function getEditorialEnrichmentSuggestions(): EditorialEnrichmentSuggestion[] {
  return readStore().suggestions;
}

export function getEditorialEnrichmentSuggestionsForDraft(
  technologyDraftId: string
): EditorialEnrichmentSuggestion[] {
  return getEditorialEnrichmentSuggestions().filter(
    (suggestion) => suggestion.technologyDraftId === technologyDraftId
  );
}

export function getEditorialEnrichmentSuggestionById(
  suggestionId: string
): EditorialEnrichmentSuggestion | undefined {
  return getEditorialEnrichmentSuggestions().find(
    (suggestion) => suggestion.id === suggestionId
  );
}

export function getLatestEditorialEnrichmentSuggestionForDraft(
  technologyDraftId: string
): EditorialEnrichmentSuggestion | undefined {
  return getEditorialEnrichmentSuggestionsForDraft(technologyDraftId)[0];
}

export function getEditorialEnrichmentReadinessState(
  technologyDraftId: string
): EditorialEnrichmentReadinessState {
  const suggestions = getEditorialEnrichmentSuggestionsForDraft(technologyDraftId);
  const latestSuggestion = suggestions[0];

  return {
    hasSuggestion: suggestions.length > 0,
    hasUnreviewedSuggestion: latestSuggestion
      ? ["draft", "stale"].includes(latestSuggestion.status)
      : false,
    latestStatus: latestSuggestion?.status
  };
}

export function saveEditorialEnrichmentSuggestions(
  suggestions: EditorialEnrichmentSuggestion[]
): void {
  writeStore({
    updatedAt: getTimestamp(),
    suggestions
  });
}

export function upsertEditorialEnrichmentSuggestion(
  suggestion: EditorialEnrichmentSuggestion
): EditorialEnrichmentSuggestion {
  const store = readStore();
  const normalizedSuggestion = normalizeSuggestion(suggestion);

  writeStore({
    updatedAt: getTimestamp(),
    suggestions: [
      normalizedSuggestion,
      ...store.suggestions.filter((item) => item.id !== normalizedSuggestion.id)
    ]
  });

  return normalizedSuggestion;
}
