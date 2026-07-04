import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { DailyDigest } from "@/types/content";

export interface DailyDigestStore {
  updatedAt: string;
  digests: DailyDigest[];
}

export function readDailyDigestStore(
  database: SqliteDatabase
): DailyDigestStore {
  return {
    updatedAt: getTimestamp(),
    digests: selectPayloads<DailyDigest>(
      database,
      "SELECT payload FROM daily_digests ORDER BY date DESC"
    )
  };
}

export function writeDailyDigestStore(
  database: SqliteDatabase,
  store: DailyDigestStore
): void {
  clearTables(database, ["daily_digests"]);

  const insertDigest = database.prepare(`
    INSERT OR REPLACE INTO daily_digests (
      id, date, status, generatedAt, updatedAt, publishedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const digest of store.digests ?? []) {
    insertDigest.run(
      digest.id,
      digest.date,
      digest.status,
      digest.generatedAt,
      digest.updatedAt,
      digest.publishedAt ?? null,
      JSON.stringify(digest)
    );
  }
}
