import { getTimestamp, selectPayloads, type SqliteDatabase } from "@/lib/repositories/sqlite-primitives";
import type { TechnologyWorkspaceRecord } from "@/types/content";

export interface TechnologyWorkspaceStore {
  updatedAt: string;
  records: TechnologyWorkspaceRecord[];
}

export function readTechnologyWorkspaceStore(
  database: SqliteDatabase
): TechnologyWorkspaceStore {
  const drafts = selectPayloads<TechnologyWorkspaceRecord>(
    database,
    "SELECT payload FROM technology_drafts ORDER BY updatedAt DESC"
  );
  const publishedWorkspaceRecords = selectPayloads<TechnologyWorkspaceRecord>(
    database,
    "SELECT payload FROM technologies WHERE recordKind = 'workspace' ORDER BY updatedAt DESC"
  );

  return {
    updatedAt: getTimestamp(),
    records: [...drafts, ...publishedWorkspaceRecords]
  };
}

export function writeTechnologyWorkspaceStore(
  database: SqliteDatabase,
  store: TechnologyWorkspaceStore
): void {
  database.prepare("DELETE FROM technology_drafts").run();
  database.prepare("DELETE FROM technologies WHERE recordKind = 'workspace'").run();

  const insertDraft = database.prepare(`
    INSERT OR REPLACE INTO technology_drafts (
      id, slug, status, sourceCandidateId, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTechnology = database.prepare(`
    INSERT OR REPLACE INTO technologies (
      id, slug, status, publishDate, recordKind, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, 'workspace', ?, ?, ?)
  `);

  for (const record of store.records ?? []) {
    if (record.status === "published") {
      insertTechnology.run(
        record.id,
        record.slug,
        record.status,
        record.publishDate,
        record.createdAt,
        record.updatedAt,
        JSON.stringify(record)
      );
    } else {
      insertDraft.run(
        record.id,
        record.slug,
        record.status,
        record.sourceCandidateId ?? null,
        record.createdAt,
        record.updatedAt,
        JSON.stringify(record)
      );
    }
  }
}
