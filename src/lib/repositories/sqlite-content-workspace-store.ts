import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { ContentWorkspaceStoreOf } from "@/lib/content-workspace-workflow";
import type { KnowledgeItem, SkillItem } from "@/types/content";

// The skill and knowledge workspace overlays: same columns, one table each.
export type SkillWorkspaceStore = ContentWorkspaceStoreOf<SkillItem>;
export type KnowledgeWorkspaceStore = ContentWorkspaceStoreOf<KnowledgeItem>;

// The radar overlay (radar-workspace.json) has the same key columns, so it
// shares these two functions with its own table.
type ContentWorkspaceTable =
  | "skill_workspace_records"
  | "knowledge_workspace_records"
  | "radar_workspace_records";

export function readContentWorkspaceStore<TItem>(
  database: SqliteDatabase,
  table: ContentWorkspaceTable
): ContentWorkspaceStoreOf<TItem> {
  return {
    updatedAt: getTimestamp(),
    records: selectPayloads<ContentWorkspaceStoreOf<TItem>["records"][number]>(
      database,
      `SELECT payload FROM ${table} ORDER BY updatedAt DESC`
    )
  };
}

export function writeContentWorkspaceStore<TItem>(
  database: SqliteDatabase,
  table: ContentWorkspaceTable,
  store: ContentWorkspaceStoreOf<TItem>
): void {
  clearTables(database, [table]);

  const insertRecord = database.prepare(`
    INSERT OR REPLACE INTO ${table} (
      id, slug, status, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const record of store.records ?? []) {
    const { id, slug, status, createdAt, updatedAt } = record as unknown as {
      id: string;
      slug: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    };

    insertRecord.run(
      id,
      slug,
      status,
      createdAt,
      updatedAt,
      JSON.stringify(record)
    );
  }
}
