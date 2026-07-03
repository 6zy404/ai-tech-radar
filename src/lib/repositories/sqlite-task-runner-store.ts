import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { TaskRunnerRun } from "@/types/content";

export interface TaskRunnerStore {
  updatedAt: string;
  runs: TaskRunnerRun[];
}

export function readTaskRunnerStore(database: SqliteDatabase): TaskRunnerStore {
  return {
    updatedAt: getTimestamp(),
    runs: selectPayloads<TaskRunnerRun>(
      database,
      "SELECT payload FROM task_runs ORDER BY startedAt DESC"
    )
  };
}

export function writeTaskRunnerStore(database: SqliteDatabase, store: TaskRunnerStore): void {
  clearTables(database, ["task_runs"]);

  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO task_runs (
      id, mode, status, startedAt, finishedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const run of store.runs ?? []) {
    insertRun.run(
      run.id,
      run.mode,
      run.status,
      run.startedAt,
      run.finishedAt,
      JSON.stringify(run)
    );
  }
}
