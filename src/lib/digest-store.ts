import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import type { DailyDigest, DailyDigestStatus } from "@/types/content";

export interface DailyDigestStore {
  updatedAt: string;
  digests: DailyDigest[];
}

const dailyDigestStorePath = getLocalStoreFilePath("daily-digests.json");

export function getTodayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDefaultDigestTitle(date: string): string {
  return `每日技术简报 - ${date}`;
}

function normalizeDigestStatus(value: unknown): DailyDigestStatus {
  return value === "published" || value === "archived" || value === "draft"
    ? value
    : "draft";
}

export function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => id.trim().length > 0)));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueIds(
    value
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0)
  );
}

export function normalizeDigest(record: Record<string, unknown>): DailyDigest {
  const date = String(record.date ?? getTodayDateString()).slice(0, 10);
  const generatedAt =
    typeof record.generatedAt === "string"
      ? record.generatedAt
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" ? record.updatedAt : generatedAt;

  return {
    id: typeof record.id === "string" ? record.id : `digest-${date}`,
    date,
    status: normalizeDigestStatus(record.status),
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title
        : getDefaultDigestTitle(date),
    summary:
      typeof record.summary === "string" && record.summary.trim()
        ? record.summary
        : "由已发布技术信号生成的每日简报。",
    editorialSummary:
      typeof record.editorialSummary === "string"
        ? record.editorialSummary
        : undefined,
    highPriorityTechnologyIds: normalizeStringArray(
      record.highPriorityTechnologyIds
    ),
    watchTechnologyIds: normalizeStringArray(record.watchTechnologyIds),
    manuallyAddedTechnologyIds: normalizeStringArray(
      record.manuallyAddedTechnologyIds
    ),
    excludedTechnologyIds: normalizeStringArray(record.excludedTechnologyIds),
    pinnedTechnologyIds: normalizeStringArray(record.pinnedTechnologyIds),
    orderedTechnologyIds: normalizeStringArray(record.orderedTechnologyIds),
    skillIds: normalizeStringArray(record.skillIds),
    knowledgeIds: normalizeStringArray(record.knowledgeIds),
    sourceNames: normalizeStringArray(record.sourceNames),
    generatedAt,
    updatedAt,
    lastRegeneratedAt:
      typeof record.lastRegeneratedAt === "string"
        ? record.lastRegeneratedAt
        : undefined,
    publishedAt:
      typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    editorialNotes: normalizeStringArray(record.editorialNotes)
  };
}

export function readDailyDigestStore(): DailyDigestStore {
  const store = readJsonFile<DailyDigestStore>(dailyDigestStorePath, {
    updatedAt: new Date().toISOString(),
    digests: []
  });

  return {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    digests: (store.digests ?? [])
      .map((digest) =>
        normalizeDigest(digest as unknown as Record<string, unknown>)
      )
      .sort((left, right) => right.date.localeCompare(left.date))
  };
}

export function writeDailyDigestStore(store: DailyDigestStore) {
  writeJsonFile(dailyDigestStorePath, {
    updatedAt: new Date().toISOString(),
    digests: store.digests.sort((left, right) =>
      right.date.localeCompare(left.date)
    )
  });
}
