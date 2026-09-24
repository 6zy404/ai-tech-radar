import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
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

/**
 * Thrown when a store file exists but does not parse. Until 2026-09-24 this
 * case silently returned the fallback value — and because every store is
 * read-modify-write of the whole file, the next save would have replaced a
 * damaged store with an empty (or, for candidates and sources, the bundled
 * mock) one and then backed that up. A loud failure is the cheaper outcome.
 */
export class LocalJsonStoreError extends Error {
  readonly filePath: string;

  constructor(filePath: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`本地数据文件无法解析，已拒绝回落为默认值：${filePath}（${reason}）`);
    this.name = "LocalJsonStoreError";
    this.filePath = filePath;
  }
}

function parseJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8");

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new LocalJsonStoreError(filePath, error);
  }
}

export function readLocalJsonFile<T>(filePath: string, fallbackValue: T): T {
  if (getPersistenceDriver() === "sqlite") {
    return readSqliteJsonStore(path.basename(filePath), fallbackValue);
  }

  if (!existsSync(filePath)) {
    return fallbackValue;
  }

  return parseJsonFile<T>(filePath);
}

const renameRetryCodes = new Set(["EPERM", "EBUSY", "EACCES"]);
const defaultRenameAttempts = 8;
const renameRetryDelayMs = 25;

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Write-then-rename, so a reader never sees a half-written file and a crash
 * mid-write leaves the previous version intact rather than a truncated one.
 * The temp file lives next to the target (same volume, so the rename is a
 * metadata operation) and carries the pid so two processes cannot share one.
 *
 * On Windows a rename over a file another process has open fails with
 * `EPERM`/`EBUSY` for a moment; the task runner, the server and an editing
 * dev server all read these files, so the rename is retried briefly before
 * giving up. On failure the temp file is removed and the error is rethrown —
 * the target is never touched.
 */
export function writeFileAtomically(
  filePath: string,
  contents: string,
  options: { attempts?: number } = {}
): void {
  const attempts = options.attempts ?? defaultRenameAttempts;
  const tempPath = `${filePath}.tmp-${process.pid}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(tempPath, contents, "utf8");

  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(tempPath, filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (attempt >= attempts || !code || !renameRetryCodes.has(code)) {
        rmSync(tempPath, { force: true });
        throw error;
      }

      sleepSync(renameRetryDelayMs * attempt);
    }
  }
}

export function writeLocalJsonFile(filePath: string, value: unknown) {
  storeRevision += 1;

  if (getPersistenceDriver() === "sqlite") {
    writeSqliteJsonStore(path.basename(filePath), value);
    return;
  }

  writeFileAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Reads the JSON file regardless of the configured driver — used by the SQLite
 * migration and its validator, which need the on-disk source of truth. A file
 * that does not parse throws for the same reason as `readLocalJsonFile`: a
 * migration that read a damaged store as empty would empty the table.
 */
export function readLocalJsonDiskFile<T>(
  filePath: string,
  fallbackValue: T
): T {
  if (!existsSync(filePath)) {
    return fallbackValue;
  }

  return parseJsonFile<T>(filePath);
}
