import { existsSync } from "node:fs";

import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import {
  normalizeIntelligenceStatus,
  normalizeReadingDifficulty,
  normalizeStoredStringList,
  normalizeStoredStringMap
} from "@/lib/workspace-record-normalizers";
import type {
  CandidateSourceReference,
  TechnologyItem,
  TechnologyWorkspaceRecord
} from "@/types/content";

export interface TechnologyWorkspaceStore {
  updatedAt: string;
  records: TechnologyWorkspaceRecord[];
}

const technologyWorkspaceStorePath = getLocalStoreFilePath(
  "technology-workspace.json"
);
const legacyTechnologyDraftStorePath = getLocalStoreFilePath(
  "technology-drafts.json"
);

function normalizeTechnologyWorkspaceRecord(
  record: Record<string, unknown>
): TechnologyWorkspaceRecord {
  const rawStatus = record.status;
  const normalizedStatus: TechnologyItem["status"] =
    rawStatus === "published" || rawStatus === "archived" || rawStatus === "draft"
      ? rawStatus
      : "draft";

  return {
    ...(record as unknown as TechnologyItem),
    status: normalizedStatus,
    sourceCandidateId:
      (record.sourceCandidateId as string | undefined) ??
      (record.draftSourceCandidateId as string | undefined),
    sourceReferences:
      (record.sourceReferences as CandidateSourceReference[] | undefined) ?? [],
    createdAt:
      (record.createdAt as string | undefined) ?? new Date().toISOString(),
    updatedAt:
      (record.updatedAt as string | undefined) ?? new Date().toISOString(),
    editorialNotes:
      (record.editorialNotes as string[] | undefined) ??
      (record.draftNotes as string[] | undefined) ??
      [],
    whyItMatters:
      typeof record.whyItMatters === "string" ? record.whyItMatters : "",
    whoShouldCare: normalizeStoredStringList(record.whoShouldCare),
    technicalContext:
      typeof record.technicalContext === "string" ? record.technicalContext : "",
    impactAreas: normalizeStoredStringList(record.impactAreas),
    learningPath: normalizeStoredStringList(record.learningPath),
    relatedKnowledgeExplanations: normalizeStoredStringMap(
      record.relatedKnowledgeExplanations
    ),
    relatedSkillExplanations: normalizeStoredStringMap(
      record.relatedSkillExplanations
    ),
    followUpQuestions: normalizeStoredStringList(record.followUpQuestions),
    readingDifficulty: normalizeReadingDifficulty(record.readingDifficulty),
    intelligenceStatus: normalizeIntelligenceStatus(record.intelligenceStatus)
  };
}

export function readTechnologyWorkspaceStore(): TechnologyWorkspaceStore {
  if (existsSync(technologyWorkspaceStorePath)) {
    const store = readJsonFile<TechnologyWorkspaceStore>(technologyWorkspaceStorePath, {
      updatedAt: new Date().toISOString(),
      records: []
    });

    return {
      updatedAt: store.updatedAt,
      records: store.records.map((record) =>
        normalizeTechnologyWorkspaceRecord(record as unknown as Record<string, unknown>)
      )
    };
  }

  if (existsSync(legacyTechnologyDraftStorePath)) {
    const legacyStore = readJsonFile<{
      updatedAt?: string;
      drafts?: Record<string, unknown>[];
    }>(legacyTechnologyDraftStorePath, {});

    return {
      updatedAt: legacyStore.updatedAt ?? new Date().toISOString(),
      records: (legacyStore.drafts ?? []).map((record) =>
        normalizeTechnologyWorkspaceRecord(record)
      )
    };
  }

  return {
    updatedAt: new Date().toISOString(),
    records: []
  };
}

export function writeTechnologyWorkspaceStore(store: TechnologyWorkspaceStore) {
  writeJsonFile(technologyWorkspaceStorePath, store);
}
