import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import { getLocalDataDirPath } from "@/lib/local-data";
import {
  getPersistenceDriver,
  readSqliteJsonStore,
  writeSqliteJsonStore
} from "@/lib/repositories/sqlite-store";

export function getLocalStoreFilePath(fileName: string): string {
  return path.join(getLocalDataDirPath(), fileName);
}

/**
 * Bumped on every store write, in either driver. Callers that memoize a derived
 * view can hold this alongside their cached value and recompute when it moves.
 *
 * It only sees writes made by *this* process, which is why
 * `getLocalStoreFingerprint` exists next to it: the task runner writes the same
 * files from its own process.
 */
let storeRevision = 0;

export function getStoreRevision(): number {
  return storeRevision;
}

/**
 * Cheap identity for a set of stores: `statSync` is microseconds against the
 * hundreds of milliseconds a parse-and-derive costs, so a caller can check this
 * on every call and still be far ahead.
 *
 * Returns `null` under the SQLite driver, where these files do not exist —
 * callers should then fall back to the in-process revision alone.
 */
export function getLocalStoreFingerprint(fileNames: string[]): string | null {
  if (getPersistenceDriver() === "sqlite") {
    return null;
  }

  return fileNames
    .map((fileName) => {
      try {
        const stats = statSync(getLocalStoreFilePath(fileName));
        return `${fileName}:${stats.mtimeMs}:${stats.size}`;
      } catch {
        return `${fileName}:absent`;
      }
    })
    .join("|");
}

export function readLocalJsonFile<T>(filePath: string, fallbackValue: T): T {
  if (getPersistenceDriver() === "sqlite") {
    return readSqliteJsonStore(path.basename(filePath), fallbackValue);
  }

  if (!existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallbackValue;
  }
}

export function writeLocalJsonFile(filePath: string, value: unknown) {
  storeRevision += 1;

  if (getPersistenceDriver() === "sqlite") {
    writeSqliteJsonStore(path.basename(filePath), value);
    return;
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readLocalJsonDiskFile<T>(
  filePath: string,
  fallbackValue: T
): T {
  if (!existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallbackValue;
  }
}
