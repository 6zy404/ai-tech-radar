import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { SkillWorkspaceRecord } from "@/types/content";

export interface SkillWorkspaceStore {
  updatedAt: string;
  records: SkillWorkspaceRecord[];
}

export function readSkillWorkspaceStore(
  database: SqliteDatabase
): SkillWorkspaceStore {
  return {
    updatedAt: getTimestamp(),
    records: selectPayloads<SkillWorkspaceRecord>(
      database,
      "SELECT payload FROM skill_workspace_records ORDER BY updatedAt DESC"
    )
  };
}

export function writeSkillWorkspaceStore(
  database: SqliteDatabase,
  store: SkillWorkspaceStore
): void {
  clearTables(database, ["skill_workspace_records"]);

  const insertRecord = database.prepare(`
    INSERT OR REPLACE INTO skill_workspace_records (
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
