import {
  parsePayload,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";

/**
 * 单对象配置（定时导入 / 定时简报草稿）在 JSON 驱动下就是一份完整的配置对象，
 * 没有记录列表可拆。这里用一张按文件名索引的 runtime_configs 表存整份 payload，
 * 与 JSON 契约保持一一对应；缺行时返回调用方给的默认配置，与
 * readLocalJsonFile 在文件不存在时的行为一致。
 */
export function readRuntimeConfig<T>(
  database: SqliteDatabase,
  name: string,
  fallbackValue: T
): T {
  const row = database
    .prepare("SELECT payload FROM runtime_configs WHERE name = ?")
    .get(name);

  if (!row) {
    return fallbackValue;
  }

  try {
    return parsePayload<T>(row);
  } catch {
    return fallbackValue;
  }
}

export function writeRuntimeConfig(
  database: SqliteDatabase,
  name: string,
  value: unknown
): void {
  const updatedAt =
    value && typeof value === "object" && "updatedAt" in value
      ? String((value as { updatedAt?: unknown }).updatedAt ?? "")
      : "";

  database
    .prepare(
      `INSERT OR REPLACE INTO runtime_configs (name, updatedAt, payload)
       VALUES (?, ?, ?)`
    )
    .run(name, updatedAt, JSON.stringify(value));
}
