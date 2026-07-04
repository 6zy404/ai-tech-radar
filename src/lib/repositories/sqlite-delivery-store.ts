import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { DeliveryChannel, DeliveryRun } from "@/types/content";

export interface DeliveryStore {
  updatedAt: string;
  channels: DeliveryChannel[];
  runs: DeliveryRun[];
}

export function readDeliveryStore(database: SqliteDatabase): DeliveryStore {
  return {
    updatedAt: getTimestamp(),
    channels: selectPayloads<DeliveryChannel>(
      database,
      "SELECT payload FROM delivery_channels ORDER BY id ASC"
    ),
    runs: selectPayloads<DeliveryRun>(
      database,
      "SELECT payload FROM delivery_logs ORDER BY startedAt DESC"
    )
  };
}

export function writeDeliveryStore(
  database: SqliteDatabase,
  store: DeliveryStore
): void {
  clearTables(database, ["delivery_logs", "delivery_channels"]);

  const insertChannel = database.prepare(`
    INSERT OR REPLACE INTO delivery_channels (
      id, type, enabled, lastDeliveryStatus, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO delivery_logs (
      id, digestId, digestDate, channelId, status, startedAt, finishedAt,
      retryOfDeliveryRunId, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const channel of store.channels ?? []) {
    insertChannel.run(
      channel.id,
      channel.type,
      channel.enabled ? 1 : 0,
      channel.lastDeliveryStatus ?? null,
      channel.createdAt,
      channel.updatedAt,
      JSON.stringify(channel)
    );
  }

  for (const run of store.runs ?? []) {
    insertRun.run(
      run.id,
      run.digestId,
      run.digestDate,
      run.channelId,
      run.status,
      run.startedAt,
      run.finishedAt ?? null,
      run.retryOfDeliveryRunId ?? null,
      JSON.stringify(run)
    );
  }
}
