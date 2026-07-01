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

function sanitizeImportedCandidate(candidate: ImportedCandidate): ImportedCandidate {
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
    ) ??
    extractedParagraphs[0];
  const fallbackContent =
    (
      getPayloadText(
        entry?.content ??
          entry?.summary ??
          item?.["content:encoded"] ??
          item?.description ??
          release?.body
      ) ?? extractedParagraphs.join("\n\n")
    ) || fallbackSummary;
  const releaseAuthor =
    release?.author && typeof release.author === "object"
      ? (release.author as Record<string, unknown>)
      : undefined;
  const fallbackPublisher =
    normalizeReadableText(
      String(
        entry?.author && typeof entry.author === "object"
          ? (entry.author as Record<string, unknown>).name ?? ""
          : item?.["dc:creator"] ??
            item?.author ??
            releaseAuthor?.login ??
            ""
      )
    ) ?? candidate.sourceName;

  return {
    ...candidate,
    sourceId:
      candidate.sourceId ??
      (typeof rawPayload?.sourceId === "string" ? rawPayload.sourceId : undefined),
    originalTitle: normalizeReadableText(candidate.originalTitle) ?? fallbackTitle,
    originalSummary: trimReadableText(candidate.originalSummary, 260) ??
      trimReadableText(fallbackSummary, 260),
    originalContent: trimReadableText(candidate.originalContent, 2200) ??
      trimReadableText(fallbackContent, 2200),
    publisherName: normalizeReadableText(candidate.publisherName) ?? fallbackPublisher,
    sourceUrl: normalizeReadableText(candidate.sourceUrl) ?? candidate.sourceUrl,
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
    const key = candidate.sourceId ?? `${candidate.sourceType}:${candidate.sourceName}`;

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
  const snapshot = readJsonFile(importedCandidatesSnapshotPath, buildFallbackSnapshot());

  return {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate) =>
      sanitizeImportedCandidate(candidate)
    )
  };
}

export function writeImportedCandidateSnapshot(snapshot: ImportedCandidateSnapshot) {
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

    return typeof rawPayload.sourceId === "string" ? rawPayload.sourceId : undefined;
  }

  return undefined;
}

export function mergeImportedCandidatesForSource(
  sourceRecord: ImportedCandidateSourceRecord,
  importedCandidates: ImportedCandidate[]
): ImportedCandidateSnapshot {
  const snapshot = readImportedCandidateSnapshot();
  const nextCandidates = [
    ...snapshot.candidates.filter(
      (candidate) => getImportedCandidateSourceId(candidate) !== sourceRecord.id
    ),
    ...importedCandidates.map((candidate) => ({
      ...candidate,
      sourceId: sourceRecord.id,
      relatedCandidateIds: Array.isArray(candidate.relatedCandidateIds)
        ? [...candidate.relatedCandidateIds]
        : []
    }))
  ].sort((left, right) => right.publishDate.localeCompare(left.publishDate));
  const nextSources = [
    ...snapshot.sources.filter((source) => source.id !== sourceRecord.id),
    sourceRecord
  ].sort((left, right) => left.sourceName.localeCompare(right.sourceName));
  const nextSnapshot = {
    syncedAt: new Date().toISOString(),
    sources: nextSources,
    candidates: nextCandidates
  };

  writeImportedCandidateSnapshot(nextSnapshot);

  return nextSnapshot;
}
