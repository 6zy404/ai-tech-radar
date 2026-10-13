import { maskSecretsInText } from "@/lib/secret-masking";
import type {
  ExternalSource,
  ImportRun,
  SourceImportHistoryEntry
} from "@/types/content";

// Per-source import history behind the health timeline on
// /workspace/sources/[id] and the 14-day success rate on the list. Until
// 2026-10-13 a source kept only its latest attempt; the batch ImportRun
// records hold more, but only the last 20 batches and nothing from a
// single-source import.

export const sourceImportHistoryLimit = 30;
export const recentSuccessWindowDays = 14;

const errorSummaryLimit = 160;

/**
 * What the history keeps of an error: no URL (a feed address can carry a
 * key), no secret, at most 160 characters.
 */
export function summarizeImportError(
  message: string | undefined
): string | undefined {
  const text = maskSecretsInText(message ?? "")
    .replace(/(?:https?|mock):\/\/[^\s)）]+/gi, "[链接]")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return undefined;
  }

  return text.length <= errorSummaryLimit
    ? text
    : `${text.slice(0, errorSummaryLimit - 1).trimEnd()}…`;
}

export function buildImportHistoryEntry(input: {
  at: string;
  status: SourceImportHistoryEntry["status"];
  candidatesCreated: number;
  candidatesSkipped: number;
  message?: string;
}): SourceImportHistoryEntry {
  const errorSummary =
    input.status === "success"
      ? undefined
      : summarizeImportError(input.message);

  return {
    at: input.at,
    status: input.status,
    candidatesCreated: Math.max(0, Math.round(input.candidatesCreated)),
    candidatesSkipped: Math.max(0, Math.round(input.candidatesSkipped)),
    ...(errorSummary ? { errorSummary } : {})
  };
}

/** Newest first, capped at `sourceImportHistoryLimit`. */
export function appendImportHistory(
  history: SourceImportHistoryEntry[] | undefined,
  entry: SourceImportHistoryEntry
): SourceImportHistoryEntry[] {
  return [entry, ...(history ?? [])]
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, sourceImportHistoryLimit);
}

/**
 * The history a source had before it was kept: its results in the stored
 * batch runs. Runs that finished before the source was created are skipped,
 * so a source re-created under a deleted one's id does not inherit it.
 */
export function backfillImportHistory(
  source: Pick<ExternalSource, "id" | "createdAt">,
  importRuns: ImportRun[]
): SourceImportHistoryEntry[] {
  const entries: SourceImportHistoryEntry[] = [];

  for (const run of importRuns) {
    if (source.createdAt && run.finishedAt < source.createdAt) {
      continue;
    }

    const result = run.sourceResults?.find(
      (item) => item.sourceId === source.id
    );

    if (!result || result.status === "never_run") {
      continue;
    }

    entries.push(
      buildImportHistoryEntry({
        at: run.finishedAt || run.startedAt,
        status: result.status,
        candidatesCreated: result.candidatesCreated ?? 0,
        candidatesSkipped: result.candidatesSkipped ?? 0,
        message: result.message
      })
    );
  }

  return entries
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, sourceImportHistoryLimit);
}

export interface RecentImportSuccess {
  successful: number;
  total: number;
  /** 0–1, or undefined when the window holds no attempt. */
  rate?: number;
}

/** A `partial` import (fallback placeholder) counts as not successful. */
export function getRecentImportSuccess(
  history: SourceImportHistoryEntry[] | undefined,
  now: Date = new Date(),
  days = recentSuccessWindowDays
): RecentImportSuccess {
  const since = new Date(
    now.getTime() - days * 24 * 60 * 60 * 1000
  ).toISOString();
  const recent = (history ?? []).filter((entry) => entry.at >= since);
  const successful = recent.filter(
    (entry) => entry.status === "success"
  ).length;

  return {
    successful,
    total: recent.length,
    rate: recent.length > 0 ? successful / recent.length : undefined
  };
}
