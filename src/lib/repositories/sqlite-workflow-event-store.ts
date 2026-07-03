import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { WorkflowEvent } from "@/types/content";

export interface WorkflowEventStore {
  updatedAt: string;
  events: WorkflowEvent[];
}

export function readWorkflowEventStore(database: SqliteDatabase): WorkflowEventStore {
  return {
    updatedAt: getTimestamp(),
    events: selectPayloads<WorkflowEvent>(
      database,
      "SELECT payload FROM workflow_events ORDER BY createdAt DESC"
    )
  };
}

export function writeWorkflowEventStore(
  database: SqliteDatabase,
  store: WorkflowEventStore
): void {
  clearTables(database, ["workflow_events"]);

  const insertEvent = database.prepare(`
    INSERT OR REPLACE INTO workflow_events (
      id, entityType, entityId, action, actorType, createdAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const event of store.events ?? []) {
    insertEvent.run(
      event.id,
      event.entityType,
      event.entityId,
      event.action,
      event.actorType,
      event.createdAt,
      JSON.stringify(event)
    );
  }
}
