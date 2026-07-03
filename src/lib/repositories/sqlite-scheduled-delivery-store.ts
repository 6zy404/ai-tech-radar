import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { ScheduledDelivery, ScheduledDeliveryRun } from "@/types/content";

export interface ScheduledDeliveryStore {
  updatedAt: string;
  schedules: ScheduledDelivery[];
  runs: ScheduledDeliveryRun[];
}

export function readScheduledDeliveryStore(
  database: SqliteDatabase
): ScheduledDeliveryStore {
  return {
    updatedAt: getTimestamp(),
    schedules: selectPayloads<ScheduledDelivery>(
      database,
      "SELECT payload FROM scheduled_deliveries ORDER BY id ASC"
    ),
    runs: selectPayloads<ScheduledDeliveryRun>(
      database,
      "SELECT payload FROM scheduled_delivery_runs ORDER BY startedAt DESC"
    )
  };
}

export function writeScheduledDeliveryStore(
  database: SqliteDatabase,
  store: ScheduledDeliveryStore
): void {
  clearTables(database, ["scheduled_delivery_runs", "scheduled_deliveries"]);

  const insertSchedule = database.prepare(`
    INSERT OR REPLACE INTO scheduled_deliveries (
      id, enabled, digestTarget, nextRunAt, lastRunStatus, createdAt, updatedAt,
      payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO scheduled_delivery_runs (
      id, scheduleId, digestId, digestDate, status, triggerType, startedAt,
      finishedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const schedule of store.schedules ?? []) {
    insertSchedule.run(
      schedule.id,
      schedule.enabled ? 1 : 0,
      schedule.digestTarget,
      schedule.nextRunAt ?? null,
      schedule.lastRunStatus,
      schedule.createdAt,
      schedule.updatedAt,
      JSON.stringify(schedule)
    );
  }

  for (const run of store.runs ?? []) {
    insertRun.run(
      run.id,
      run.scheduleId,
      run.digestId ?? null,
      run.digestDate ?? null,
      run.status,
      run.triggerType,
      run.startedAt,
      run.finishedAt ?? null,
      JSON.stringify(run)
    );
  }
}
