import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { ExternalSource, ImportRun } from "@/types/content";

export interface ExternalSourceStore {
  updatedAt: string;
  sources: ExternalSource[];
  latestImportRun?: ImportRun;
  importRuns?: ImportRun[];
}

export function readExternalSourceStore(database: SqliteDatabase): ExternalSourceStore {
  const sources = selectPayloads<ExternalSource>(
    database,
    "SELECT payload FROM sources ORDER BY name ASC"
  );
  const importRuns = selectPayloads<ImportRun>(
    database,
    "SELECT payload FROM import_runs ORDER BY startedAt DESC"
  );

  return {
    updatedAt: getTimestamp(),
    sources,
    latestImportRun: importRuns[0],
    importRuns
  };
}

export function writeExternalSourceStore(
  database: SqliteDatabase,
  store: ExternalSourceStore
): void {
  clearTables(database, ["import_run_source_results", "import_runs", "sources"]);

  const insertSource = database.prepare(`
    INSERT OR REPLACE INTO sources (
      id, name, type, url, enabled, status, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO import_runs (
      id, status, startedAt, finishedAt, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertRunResult = database.prepare(`
    INSERT OR REPLACE INTO import_run_source_results (
      importRunId, sourceId, status, payload
    ) VALUES (?, ?, ?, ?)
  `);

  for (const source of store.sources ?? []) {
    insertSource.run(
      source.id,
      source.name,
      source.type,
      source.url,
      source.enabled ? 1 : 0,
      source.lastImportStatus,
      source.createdAt,
      source.updatedAt,
      JSON.stringify(source)
    );
  }

  for (const run of store.importRuns ?? []) {
    insertRun.run(
      run.id,
      run.status,
      run.startedAt,
      run.finishedAt,
      JSON.stringify(run)
    );

    for (const result of run.sourceResults ?? []) {
      insertRunResult.run(
        run.id,
        result.sourceId,
        result.status,
        JSON.stringify(result)
      );
    }
  }
}
