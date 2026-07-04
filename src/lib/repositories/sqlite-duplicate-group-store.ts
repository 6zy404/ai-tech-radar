import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { DuplicateGroup } from "@/types/content";

export interface DuplicateGroupStore {
  updatedAt: string;
  groups: DuplicateGroup[];
}

export function readDuplicateGroupStore(
  database: SqliteDatabase
): DuplicateGroupStore {
  return {
    updatedAt: getTimestamp(),
    groups: selectPayloads<DuplicateGroup>(
      database,
      "SELECT payload FROM duplicate_groups ORDER BY updatedAt DESC"
    )
  };
}

export function writeDuplicateGroupStore(
  database: SqliteDatabase,
  store: DuplicateGroupStore
): void {
  clearTables(database, ["duplicate_groups"]);

  const insertGroup = database.prepare(`
    INSERT OR REPLACE INTO duplicate_groups (
      id, status, primaryCandidateId, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const group of store.groups ?? []) {
    insertGroup.run(
      group.id,
      group.status,
      group.primaryCandidateId,
      group.createdAt,
      group.updatedAt,
      JSON.stringify(group)
    );
  }
}
