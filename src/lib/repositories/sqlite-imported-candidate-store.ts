import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type {
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ImportedCandidateSourceRecord
} from "@/types/content";

export function readImportedCandidateSnapshot(
  database: SqliteDatabase
): ImportedCandidateSnapshot {
  return {
    syncedAt: getTimestamp(),
    sources: selectPayloads<ImportedCandidateSourceRecord>(
      database,
      "SELECT payload FROM imported_candidate_sources ORDER BY fetchedAt DESC"
    ),
    candidates: selectPayloads<ImportedCandidate>(
      database,
      "SELECT payload FROM imported_candidates ORDER BY publishDate DESC, id ASC"
    )
  };
}

export function writeImportedCandidateSnapshot(
  database: SqliteDatabase,
  snapshot: ImportedCandidateSnapshot
): void {
  clearTables(database, ["imported_candidate_sources", "imported_candidates"]);

  const insertSource = database.prepare(`
    INSERT OR REPLACE INTO imported_candidate_sources (
      id, sourceType, sourceUrl, fetchedAt, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertCandidate = database.prepare(`
    INSERT OR REPLACE INTO imported_candidates (
      id, sourceId, sourceUrl, importStatus, duplicateGroupId,
      convertedTechnologyId, publishDate, importedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const source of snapshot.sources ?? []) {
    insertSource.run(
      source.id,
      source.sourceType,
      source.sourceUrl,
      source.fetchedAt,
      JSON.stringify(source)
    );
  }

  for (const candidate of snapshot.candidates ?? []) {
    insertCandidate.run(
      candidate.id,
      candidate.sourceId ?? null,
      candidate.sourceUrl,
      candidate.importStatus,
      candidate.duplicateGroupId ?? null,
      candidate.convertedTechnologyId ?? null,
      candidate.publishDate,
      candidate.importedAt ?? null,
      JSON.stringify(candidate)
    );
  }
}
