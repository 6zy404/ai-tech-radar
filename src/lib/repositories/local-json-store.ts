import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
