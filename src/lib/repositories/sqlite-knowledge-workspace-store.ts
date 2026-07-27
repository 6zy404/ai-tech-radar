import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { KnowledgeWorkspaceRecord } from "@/types/content";

export interface KnowledgeWorkspaceStore {
  updatedAt: string;
  records: KnowledgeWorkspaceRecord[];
}

export function readKnowledgeWorkspaceStore(
  database: SqliteDatabase
): KnowledgeWorkspaceStore {
  return {
    updatedAt: getTimestamp(),
    records: selectPayloads<KnowledgeWorkspaceRecord>(
      database,
      "SELECT payload FROM knowledge_workspace_records ORDER BY updatedAt DESC"
    )
  };
}

export function writeKnowledgeWorkspaceStore(
  database: SqliteDatabase,
  store: KnowledgeWorkspaceStore
): void {
  clearTables(database, ["knowledge_workspace_records"]);

  const insertRecord = database.prepare(`
    INSERT OR REPLACE INTO knowledge_workspace_records (
      id, slug, status, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const record of store.records ?? []) {
    insertRecord.run(
      record.id,
      record.slug,
      record.status,
      record.createdAt,
      record.updatedAt,
      JSON.stringify(record)
    );
  }
}
