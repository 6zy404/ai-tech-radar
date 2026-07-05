import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import type {
  TechnologyExplanationAudienceLevel,
  TechnologyExplanationRecord
} from "@/types/content";

export interface TechnologyExplanationStore {
  updatedAt: string;
  explanations: TechnologyExplanationRecord[];
}

const explanationStorePath = getLocalStoreFilePath(
  "technology-explanations.json"
);

export function getExplanationCacheKey(
  technologyId: string,
  audienceLevel: TechnologyExplanationAudienceLevel
): string {
  return `${technologyId}::${audienceLevel}`;
}

function normalizeAudienceLevel(
  value: unknown
): TechnologyExplanationAudienceLevel {
  return value === "beginner" || value === "advanced" ? value : "intermediate";
}

function normalizeExplanationFields(
  value: unknown
): TechnologyExplanationRecord["fields"] {
  const record = (value ?? {}) as Record<string, unknown>;

  return {
    explanation: String(record.explanation ?? ""),
    keyPoints: Array.isArray(record.keyPoints)
      ? (record.keyPoints as string[])
      : [],
    analogy: typeof record.analogy === "string" ? record.analogy : undefined,
    nextSteps: Array.isArray(record.nextSteps)
      ? (record.nextSteps as string[])
      : undefined
  };
}

function normalizeExplanationRecord(
  record: Record<string, unknown>
): TechnologyExplanationRecord {
  const now = new Date().toISOString();
  const technologyId = String(record.technologyId ?? "");
  const audienceLevel = normalizeAudienceLevel(record.audienceLevel);

  return {
    id: typeof record.id === "string" ? record.id : `explanation-${now}`,
    cacheKey:
      typeof record.cacheKey === "string"
        ? record.cacheKey
        : getExplanationCacheKey(technologyId, audienceLevel),
    technologyId,
    audienceLevel,
    fields: normalizeExplanationFields(record.fields),
    generationMode:
      record.generationMode === "llm_assisted" ? "llm_assisted" : "mock_llm",
    providerName:
      typeof record.providerName === "string" ? record.providerName : undefined,
    modelName:
      typeof record.modelName === "string" ? record.modelName : undefined,
    promptVersionId:
      typeof record.promptVersionId === "string"
        ? record.promptVersionId
        : undefined,
    promptVersion:
      typeof record.promptVersion === "string"
        ? record.promptVersion
        : undefined,
    outputValidationStatus:
      record.outputValidationStatus === "valid" ||
      record.outputValidationStatus === "warning" ||
      record.outputValidationStatus === "failed"
        ? record.outputValidationStatus
        : "failed",
    outputValidationWarnings: Array.isArray(record.outputValidationWarnings)
      ? (record.outputValidationWarnings as string[])
      : [],
    generationError:
      typeof record.generationError === "string"
        ? record.generationError
        : undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now
  };
}

function readExplanationStore(): TechnologyExplanationStore {
  const store = readJsonFile<TechnologyExplanationStore>(explanationStorePath, {
    updatedAt: new Date().toISOString(),
    explanations: []
  });

  return {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    explanations: (store.explanations ?? []).map((record) =>
      normalizeExplanationRecord(record as unknown as Record<string, unknown>)
    )
  };
}

function writeExplanationStore(store: TechnologyExplanationStore) {
  writeJsonFile(explanationStorePath, {
    updatedAt: new Date().toISOString(),
    explanations: store.explanations
  });
}

export function getTechnologyExplanationByCacheKey(
  cacheKey: string
): TechnologyExplanationRecord | undefined {
  return readExplanationStore().explanations.find(
    (record) => record.cacheKey === cacheKey
  );
}

export function saveTechnologyExplanationRecord(
  record: TechnologyExplanationRecord
): TechnologyExplanationRecord {
  const store = readExplanationStore();
  const nextRecord = normalizeExplanationRecord(
    record as unknown as Record<string, unknown>
  );

  writeExplanationStore({
    updatedAt: new Date().toISOString(),
    explanations: [
      ...store.explanations.filter(
        (item) => item.cacheKey !== nextRecord.cacheKey
      ),
      nextRecord
    ]
  });

  return nextRecord;
}
