import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import type { TechnologyComparisonRecord } from "@/types/content";

export interface TechnologyComparisonStore {
  updatedAt: string;
  comparisons: TechnologyComparisonRecord[];
}

const comparisonStorePath = getLocalStoreFilePath(
  "technology-comparisons.json"
);

export function getComparisonPairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join("::");
}

function normalizeComparisonFields(
  value: unknown
): TechnologyComparisonRecord["fields"] {
  const record = (value ?? {}) as Record<string, unknown>;

  return {
    similarities: Array.isArray(record.similarities)
      ? (record.similarities as string[])
      : [],
    differences: Array.isArray(record.differences)
      ? (record.differences as string[])
      : [],
    whenToPreferA: String(record.whenToPreferA ?? ""),
    whenToPreferB: String(record.whenToPreferB ?? ""),
    sharedConsiderations: Array.isArray(record.sharedConsiderations)
      ? (record.sharedConsiderations as string[])
      : undefined
  };
}

function normalizeComparisonRecord(
  record: Record<string, unknown>
): TechnologyComparisonRecord {
  const now = new Date().toISOString();

  return {
    id: typeof record.id === "string" ? record.id : `comparison-${now}`,
    pairKey: String(record.pairKey ?? ""),
    technologyIdA: String(record.technologyIdA ?? ""),
    technologyIdB: String(record.technologyIdB ?? ""),
    fields: normalizeComparisonFields(record.fields),
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

function readComparisonStore(): TechnologyComparisonStore {
  const store = readJsonFile<TechnologyComparisonStore>(comparisonStorePath, {
    updatedAt: new Date().toISOString(),
    comparisons: []
  });

  return {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    comparisons: (store.comparisons ?? []).map((record) =>
      normalizeComparisonRecord(record as unknown as Record<string, unknown>)
    )
  };
}

function writeComparisonStore(store: TechnologyComparisonStore) {
  writeJsonFile(comparisonStorePath, {
    updatedAt: new Date().toISOString(),
    comparisons: store.comparisons
  });
}

export function getTechnologyComparisonByPairKey(
  pairKey: string
): TechnologyComparisonRecord | undefined {
  return readComparisonStore().comparisons.find(
    (record) => record.pairKey === pairKey
  );
}

export function saveTechnologyComparisonRecord(
  record: TechnologyComparisonRecord
): TechnologyComparisonRecord {
  const store = readComparisonStore();
  const nextRecord = normalizeComparisonRecord(
    record as unknown as Record<string, unknown>
  );

  writeComparisonStore({
    updatedAt: new Date().toISOString(),
    comparisons: [
      ...store.comparisons.filter(
        (item) => item.pairKey !== nextRecord.pairKey
      ),
      nextRecord
    ]
  });

  return nextRecord;
}
