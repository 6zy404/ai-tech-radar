export type SqlitePrimitive = string | number | null;

export interface SqliteStatement {
  all(...values: SqlitePrimitive[]): Record<string, unknown>[];
  get(...values: SqlitePrimitive[]): Record<string, unknown> | undefined;
  run(...values: SqlitePrimitive[]): unknown;
}

export interface SqliteDatabase {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

export function getTimestamp(): string {
  return new Date().toISOString();
}

export function parsePayload<T>(row: Record<string, unknown>): T {
  return JSON.parse(String(row.payload)) as T;
}

export function getTableCount(
  database: SqliteDatabase,
  tableName: string
): number {
  const row = database
    .prepare(`SELECT COUNT(*) AS rowCount FROM ${tableName}`)
    .get();

  return Number(row?.rowCount ?? 0);
}

export function selectPayloads<T>(
  database: SqliteDatabase,
  sql: string,
  ...values: SqlitePrimitive[]
): T[] {
  return database
    .prepare(sql)
    .all(...values)
    .map(parsePayload<T>);
}

export function clearTables(
  database: SqliteDatabase,
  tableNames: string[]
): void {
  for (const tableName of tableNames) {
    database.prepare(`DELETE FROM ${tableName}`).run();
  }
}

export function runSqliteTransaction(
  database: SqliteDatabase,
  action: () => void
): void {
  database.exec("BEGIN IMMEDIATE;");

  try {
    action();
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
