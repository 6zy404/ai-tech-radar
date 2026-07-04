import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";

export interface CandidateReviewStateEntry {
  importStatus: string;
  reviewedAt?: string;
  convertedTechnologyId?: string;
}

export interface CandidateReviewStateFile {
  updatedAt: string;
  items: Record<string, CandidateReviewStateEntry>;
}

export function readCandidateReviewState(
  database: SqliteDatabase
): CandidateReviewStateFile {
  const entries = selectPayloads<
    CandidateReviewStateEntry & { candidateId: string }
  >(
    database,
    "SELECT payload FROM candidate_review_states ORDER BY candidateId ASC"
  );

  return {
    updatedAt: getTimestamp(),
    items: Object.fromEntries(
      entries.map((entry) => {
        const { candidateId, ...state } = entry;

        return [candidateId, state];
      })
    )
  };
}

export function writeCandidateReviewState(
  database: SqliteDatabase,
  state: CandidateReviewStateFile
): void {
  clearTables(database, ["candidate_review_states"]);

  const insertState = database.prepare(`
    INSERT OR REPLACE INTO candidate_review_states (
      candidateId, importStatus, reviewedAt, convertedTechnologyId, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const [candidateId, entry] of Object.entries(state.items ?? {})) {
    insertState.run(
      candidateId,
      entry.importStatus,
      entry.reviewedAt ?? null,
      entry.convertedTechnologyId ?? null,
      JSON.stringify({ candidateId, ...entry })
    );
  }
}
