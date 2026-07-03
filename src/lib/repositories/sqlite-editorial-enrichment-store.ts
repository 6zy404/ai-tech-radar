import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type { EditorialEnrichmentSuggestion } from "@/types/content";

export interface EditorialEnrichmentSuggestionStore {
  updatedAt: string;
  suggestions: EditorialEnrichmentSuggestion[];
}

export function readEditorialEnrichmentSuggestionStore(
  database: SqliteDatabase
): EditorialEnrichmentSuggestionStore {
  return {
    updatedAt: getTimestamp(),
    suggestions: selectPayloads<EditorialEnrichmentSuggestion>(
      database,
      "SELECT payload FROM editorial_enrichment_suggestions ORDER BY createdAt DESC"
    )
  };
}

export function writeEditorialEnrichmentSuggestionStore(
  database: SqliteDatabase,
  store: EditorialEnrichmentSuggestionStore
): void {
  clearTables(database, ["editorial_enrichment_suggestions"]);

  const insertSuggestion = database.prepare(`
    INSERT OR REPLACE INTO editorial_enrichment_suggestions (
      id, technologyDraftId, status, generationMode, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const suggestion of store.suggestions ?? []) {
    insertSuggestion.run(
      suggestion.id,
      suggestion.technologyDraftId,
      suggestion.status,
      suggestion.generationMode,
      suggestion.createdAt,
      suggestion.updatedAt,
      JSON.stringify(suggestion)
    );
  }
}
