import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import type { TechnologyLearningPathRecord } from "@/types/content";

export interface TechnologyLearningPathStore {
  updatedAt: string;
  learningPaths: TechnologyLearningPathRecord[];
}

const learningPathStorePath = getLocalStoreFilePath(
  "technology-learning-paths.json"
);

function normalizeLearningPathFields(
  value: unknown
): TechnologyLearningPathRecord["fields"] {
  const record = (value ?? {}) as Record<string, unknown>;

  return {
    overview: String(record.overview ?? ""),
    steps: Array.isArray(record.steps) ? (record.steps as string[]) : [],
    checkpoints: Array.isArray(record.checkpoints)
      ? (record.checkpoints as string[])
      : undefined
  };
}

function normalizeLearningPathRecord(
  record: Record<string, unknown>
): TechnologyLearningPathRecord {
  const now = new Date().toISOString();

  return {
    id: typeof record.id === "string" ? record.id : `learning-path-${now}`,
    technologyId: String(record.technologyId ?? ""),
    fields: normalizeLearningPathFields(record.fields),
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

function readLearningPathStore(): TechnologyLearningPathStore {
  const store = readJsonFile<TechnologyLearningPathStore>(
    learningPathStorePath,
    {
      updatedAt: new Date().toISOString(),
      learningPaths: []
    }
  );

  return {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    learningPaths: (store.learningPaths ?? []).map((record) =>
      normalizeLearningPathRecord(record as unknown as Record<string, unknown>)
    )
  };
}

function writeLearningPathStore(store: TechnologyLearningPathStore) {
  writeJsonFile(learningPathStorePath, {
    updatedAt: new Date().toISOString(),
    learningPaths: store.learningPaths
  });
}

export function getTechnologyLearningPathByTechnologyId(
  technologyId: string
): TechnologyLearningPathRecord | undefined {
  return readLearningPathStore().learningPaths.find(
    (record) => record.technologyId === technologyId
  );
}

export function saveTechnologyLearningPathRecord(
  record: TechnologyLearningPathRecord
): TechnologyLearningPathRecord {
  const store = readLearningPathStore();
  const nextRecord = normalizeLearningPathRecord(
    record as unknown as Record<string, unknown>
  );

  writeLearningPathStore({
    updatedAt: new Date().toISOString(),
    learningPaths: [
      ...store.learningPaths.filter(
        (item) => item.technologyId !== nextRecord.technologyId
      ),
      nextRecord
    ]
  });

  return nextRecord;
}
