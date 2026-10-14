import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  migrateJsonStoresToSqlite,
  openSqliteDatabase,
  readSqliteJsonStore,
  runtimeConfigStoreFileNames,
  writeSqliteJsonStore
} from "@/lib/repositories/sqlite-store";

/**
 * Pins the single-object stores to `runtime_configs` in all three places that
 * handle them. Until 2026-10-14 `db:migrate-json` copied only the two schedule
 * configs, so a switch to SQLite dropped the 本周总结 records, the triage and
 * semantic-match caches and every reader push subscription.
 */

const at = "2026-10-14T00:00:00.000Z";

let dataDir: string;
let previousDataDir: string | undefined;
let previousDatabasePath: string | undefined;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "sqlite-store-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  previousDatabasePath = process.env.SQLITE_DATABASE_PATH;
  process.env.LOCAL_DATA_DIR = dataDir;
  delete process.env.SQLITE_DATABASE_PATH;
});

afterEach(() => {
  if (previousDataDir === undefined) {
    delete process.env.LOCAL_DATA_DIR;
  } else {
    process.env.LOCAL_DATA_DIR = previousDataDir;
  }

  if (previousDatabasePath !== undefined) {
    process.env.SQLITE_DATABASE_PATH = previousDatabasePath;
  }

  rmSync(dataDir, { recursive: true, force: true });
});

function emptyStores() {
  return {
    externalSources: { updatedAt: at, sources: [], importRuns: [] },
    importedCandidates: { syncedAt: at, sources: [], candidates: [] },
    candidateReviewState: { updatedAt: at, items: {} },
    duplicateGroups: { updatedAt: at, groups: [] },
    technologyWorkspace: { updatedAt: at, records: [] },
    dailyDigests: { updatedAt: at, digests: [] },
    delivery: { updatedAt: at, channels: [], runs: [] },
    scheduledDelivery: { updatedAt: at, schedules: [], runs: [] },
    taskRunner: { updatedAt: at, runs: [] }
  };
}

function runtimeConfigRowNames(): string[] {
  const database = openSqliteDatabase();

  try {
    return database
      .prepare("SELECT name FROM runtime_configs ORDER BY name")
      .all()
      .map((row) => String(row.name));
  } finally {
    database.close();
  }
}

describe("runtime-config stores under SQLite", () => {
  it("migrates every runtime-config store and reads each one back", () => {
    const runtimeConfigs = Object.fromEntries(
      runtimeConfigStoreFileNames.map((fileName) => [
        fileName,
        { updatedAt: at, marker: fileName }
      ])
    );

    const summary = migrateJsonStoresToSqlite({
      ...emptyStores(),
      runtimeConfigs
    });

    expect(summary.errors).toBe(0);
    expect(summary.runtimeConfigs).toBe(runtimeConfigStoreFileNames.length);

    for (const fileName of runtimeConfigStoreFileNames) {
      expect(readSqliteJsonStore(fileName, undefined)).toEqual({
        updatedAt: at,
        marker: fileName
      });
    }
  });

  it("leaves a store that does not exist on disk out of the database", () => {
    migrateJsonStoresToSqlite({
      ...emptyStores(),
      runtimeConfigs: {
        "push-subscriptions.json": { updatedAt: at, subscriptions: [] },
        "weekly-summaries.json": undefined
      }
    });

    expect(runtimeConfigRowNames()).toEqual(["push-subscriptions.json"]);
    expect(readSqliteJsonStore("weekly-summaries.json", "fallback")).toBe(
      "fallback"
    );
  });

  it("still accepts the two schedule configs as named fields", () => {
    migrateJsonStoresToSqlite({
      ...emptyStores(),
      scheduledImport: { updatedAt: at, enabled: true },
      scheduledDigest: { updatedAt: at, enabled: false }
    });

    expect(runtimeConfigRowNames()).toEqual([
      "scheduled-digest.json",
      "scheduled-import.json"
    ]);
  });

  it("routes a write of every runtime-config store to runtime_configs", () => {
    for (const fileName of runtimeConfigStoreFileNames) {
      writeSqliteJsonStore(fileName, { updatedAt: at, marker: fileName });
    }

    expect(runtimeConfigRowNames()).toEqual(
      [...runtimeConfigStoreFileNames].sort()
    );
  });
});
