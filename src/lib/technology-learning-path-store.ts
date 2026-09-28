import { normalizeAiGenerationMetadata } from "@/lib/ai-generation-record";
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
    ...normalizeAiGenerationMetadata(record)
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
