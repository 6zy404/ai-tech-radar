import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { LinkRelation } from "@/types/content";

export interface LinkRelationWorkspaceStore {
  updatedAt: string;
  relations: LinkRelation[];
}

export function readLinkRelationWorkspaceStore(
  database: SqliteDatabase
): LinkRelationWorkspaceStore {
  return {
    updatedAt: getTimestamp(),
    relations: selectPayloads<LinkRelation>(
      database,
      "SELECT payload FROM link_relation_overrides ORDER BY id ASC"
    )
  };
}

export function writeLinkRelationWorkspaceStore(
  database: SqliteDatabase,
  store: LinkRelationWorkspaceStore
): void {
  clearTables(database, ["link_relation_overrides"]);

  const insertRelation = database.prepare(`
    INSERT OR REPLACE INTO link_relation_overrides (
      id, fromId, fromType, toId, toType, relationType, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const relation of store.relations ?? []) {
    insertRelation.run(
      relation.id,
      relation.fromId,
      relation.fromType,
      relation.toId,
      relation.toType,
      relation.relationType,
      JSON.stringify(relation)
    );
  }
}
