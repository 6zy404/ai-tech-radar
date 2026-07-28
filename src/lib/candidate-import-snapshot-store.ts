import { buildFallbackImportedCandidates } from "@/lib/importers";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import {
  getPayloadText,
  normalizeReadableText,
  stripMarkup,
  trimReadableText
} from "@/lib/workspace-record-normalizers";
import type {
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ImportedCandidateSourceRecord
} from "@/types/content";

const importedCandidatesSnapshotPath = getLocalStoreFilePath(
  "imported-candidates.live.json"
);

function sanitizeImportedCandidate(
  candidate: ImportedCandidate
): ImportedCandidate {
  const rawPayload =
    candidate.rawPayload && typeof candidate.rawPayload === "object"
      ? (candidate.rawPayload as Record<string, unknown>)
      : undefined;
  const entry =
    rawPayload?.entry && typeof rawPayload.entry === "object"
      ? (rawPayload.entry as Record<string, unknown>)
      : undefined;
  const item =
    rawPayload?.item && typeof rawPayload.item === "object"
      ? (rawPayload.item as Record<string, unknown>)
      : undefined;
  const release =
    rawPayload?.release && typeof rawPayload.release === "object"
      ? (rawPayload.release as Record<string, unknown>)
      : undefined;
  const listingPreview =
    rawPayload?.listingPreview && typeof rawPayload.listingPreview === "object"
      ? (rawPayload.listingPreview as Record<string, unknown>)
      : undefined;
  const extractedParagraphs = Array.isArray(rawPayload?.extractedParagraphs)
    ? rawPayload?.extractedParagraphs
        .map((paragraph) => stripMarkup(String(paragraph ?? "")))
        .filter((paragraph): paragraph is string => Boolean(paragraph))
    : [];
  const fallbackTitle =
    getPayloadText(entry?.title ?? item?.title ?? release?.name) ??
    candidate.sourceName;
  const fallbackSummary =
    getPayloadText(
      entry?.summary ??
        entry?.content ??
        item?.description ??
        item?.["content:encoded"] ??
        release?.body ??
        listingPreview?.excerpt
    ) ?? extractedParagraphs[0];
  const fallbackContent =
    (getPayloadText(
      entry?.content ??
        entry?.summary ??
        item?.["content:encoded"] ??
        item?.description ??
        release?.body
    ) ??
      extractedParagraphs.join("\n\n")) ||
    fallbackSummary;
  const releaseAuthor =
    release?.author && typeof release.author === "object"
      ? (release.author as Record<string, unknown>)
      : undefined;
  const fallbackPublisher =
    normalizeReadableText(
      String(
        entry?.author && typeof entry.author === "object"
          ? ((entry.author as Record<string, unknown>).name ?? "")
          : (item?.["dc:creator"] ?? item?.author ?? releaseAuthor?.login ?? "")
      )
    ) ?? candidate.sourceName;

  return {
    ...candidate,
    sourceId:
      candidate.sourceId ??
      (typeof rawPayload?.sourceId === "string"
        ? rawPayload.sourceId
        : undefined),
    originalTitle:
      normalizeReadableText(candidate.originalTitle) ?? fallbackTitle,
    originalSummary:
      trimReadableText(candidate.originalSummary, 260) ??
      trimReadableText(fallbackSummary, 260),
    originalContent:
      trimReadableText(candidate.originalContent, 2200) ??
      trimReadableText(fallbackContent, 2200),
    publisherName:
      normalizeReadableText(candidate.publisherName) ?? fallbackPublisher,
    sourceUrl:
      normalizeReadableText(candidate.sourceUrl) ?? candidate.sourceUrl,
    relatedCandidateIds: Array.isArray(candidate.relatedCandidateIds)
      ? [...candidate.relatedCandidateIds]
      : []
  };
}

function buildFallbackSnapshot(): ImportedCandidateSnapshot {
  const candidates = buildFallbackImportedCandidates();
  const groupedSourceRecords = new Map<
    string,
    ImportedCandidateSnapshot["sources"][number]
  >();

  for (const candidate of candidates) {
    const key =
      candidate.sourceId ?? `${candidate.sourceType}:${candidate.sourceName}`;

    if (!groupedSourceRecords.has(key)) {
      groupedSourceRecords.set(key, {
        id: key,
        sourceType: candidate.sourceType,
        sourceName: candidate.sourceName,
        sourceUrl: candidate.sourceUrl,
        syncStatus: "fallback",
        itemCount: 0,
        fetchedAt: new Date().toISOString(),
        note: "Bundled mock fallback data."
      });
    }

    const record = groupedSourceRecords.get(key);

    if (record) {
      record.itemCount += 1;
    }
  }

  return {
    syncedAt: new Date().toISOString(),
    sources: Array.from(groupedSourceRecords.values()),
    candidates
  };
}

export function readImportedCandidateSnapshot(): ImportedCandidateSnapshot {
  const snapshot = readJsonFile(
    importedCandidatesSnapshotPath,
    buildFallbackSnapshot()
  );

  return {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate) =>
      sanitizeImportedCandidate(candidate)
    )
  };
}

export function writeImportedCandidateSnapshot(
  snapshot: ImportedCandidateSnapshot
) {
  writeJsonFile(importedCandidatesSnapshotPath, snapshot);
}

export function getImportedCandidateSourceId(
  candidate: ImportedCandidate
): string | undefined {
  if (candidate.sourceId) {
    return candidate.sourceId;
  }

  if (candidate.rawPayload && typeof candidate.rawPayload === "object") {
    const rawPayload = candidate.rawPayload as Record<string, unknown>;

    return typeof rawPayload.sourceId === "string"
      ? rawPayload.sourceId
      : undefined;
  }

  return undefined;
}

export interface MergeImportedCandidatesOptions {
  /**
   * Keep the candidates a previous run already captured for this source and
   * only append the ones that are genuinely new.
   *
   * The default (replace) is right for a successful live import: the feed is
   * the current truth, and the snapshot is a rolling window whose entries age
   * out while `candidate-review-state.json` keeps every decision. It is wrong
   * for a *failed* import that falls back to a placeholder, because a replace
   * there discards real candidates in exchange for one synthetic row — which
   * is how a manual re-run destroyed the recovered Ollama v0.32.5 candidate on
   * 2026-07-28.
   */
  preserveExistingCandidates?: boolean;
}

function withSourceId(
  candidate: ImportedCandidate,
  sourceId: string
): ImportedCandidate {
  return {
    ...candidate,
    sourceId,
    relatedCandidateIds: Array.isArray(candidate.relatedCandidateIds)
      ? [...candidate.relatedCandidateIds]
      : []
  };
}

/**
 * Pure core of {@link mergeImportedCandidatesForSource}: no file I/O and no
 * clock of its own, so the merge rules can be unit tested directly.
 */
export function buildMergedCandidateSnapshot(
  snapshot: ImportedCandidateSnapshot,
  sourceRecord: ImportedCandidateSourceRecord,
  importedCandidates: ImportedCandidate[],
  syncedAt: string,
  options: MergeImportedCandidatesOptions = {}
): ImportedCandidateSnapshot {
  const belongsToSource = (candidate: ImportedCandidate) =>
    getImportedCandidateSourceId(candidate) === sourceRecord.id;
  const otherSourceCandidates = snapshot.candidates.filter(
    (candidate) => !belongsToSource(candidate)
  );
  const existingForSource = snapshot.candidates.filter(belongsToSource);

  let candidatesForSource: ImportedCandidate[];
  let nextSourceRecord = sourceRecord;

  if (options.preserveExistingCandidates) {
    // A placeholder always carries the source's own feed URL, so a second
    // failure on another day would otherwise stack a near-identical row.
    const seenIds = new Set(existingForSource.map((candidate) => candidate.id));
    const seenUrls = new Set(
      existingForSource
        .map((candidate) => candidate.sourceUrl)
        .filter((url): url is string => Boolean(url))
    );
    const additions = importedCandidates.filter(
      (candidate) =>
        !seenIds.has(candidate.id) &&
        !(candidate.sourceUrl && seenUrls.has(candidate.sourceUrl))
    );

    candidatesForSource = [
      ...existingForSource,
      ...additions.map((candidate) => withSourceId(candidate, sourceRecord.id))
    ];
    // The caller sized the record from the incoming batch alone, which no
    // longer describes what the source holds once nothing was dropped.
    nextSourceRecord = {
      ...sourceRecord,
      itemCount: candidatesForSource.length
    };
  } else {
    candidatesForSource = importedCandidates.map((candidate) =>
      withSourceId(candidate, sourceRecord.id)
    );
  }

  const nextCandidates = [
    ...otherSourceCandidates,
    ...candidatesForSource
  ].sort((left, right) => right.publishDate.localeCompare(left.publishDate));
  const nextSources = [
    ...snapshot.sources.filter((source) => source.id !== sourceRecord.id),
    nextSourceRecord
  ].sort((left, right) => left.sourceName.localeCompare(right.sourceName));

  return {
    syncedAt,
    sources: nextSources,
    candidates: nextCandidates
  };
}

export function mergeImportedCandidatesForSource(
  sourceRecord: ImportedCandidateSourceRecord,
  importedCandidates: ImportedCandidate[],
  options: MergeImportedCandidatesOptions = {}
): ImportedCandidateSnapshot {
  const nextSnapshot = buildMergedCandidateSnapshot(
    readImportedCandidateSnapshot(),
    sourceRecord,
    importedCandidates,
    new Date().toISOString(),
    options
  );

  writeImportedCandidateSnapshot(nextSnapshot);

  return nextSnapshot;
}
