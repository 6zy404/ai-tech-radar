import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { PromptVersion } from "@/types/content";

export interface PromptVersionStore {
  updatedAt: string;
  promptVersions: PromptVersion[];
}

export function readPromptVersionStore(database: SqliteDatabase): PromptVersionStore {
  return {
    updatedAt: getTimestamp(),
    promptVersions: selectPayloads<PromptVersion>(
      database,
      "SELECT payload FROM prompt_versions ORDER BY updatedAt DESC"
    )
  };
}

export function writePromptVersionStore(
  database: SqliteDatabase,
  store: PromptVersionStore
): void {
  clearTables(database, ["prompt_versions"]);

  const insertPromptVersion = database.prepare(`
    INSERT OR REPLACE INTO prompt_versions (
      id, purpose, version, status, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const promptVersion of store.promptVersions ?? []) {
    insertPromptVersion.run(
      promptVersion.id,
      promptVersion.purpose,
      promptVersion.version,
      promptVersion.status,
      promptVersion.updatedAt,
      JSON.stringify(promptVersion)
    );
  }
}
