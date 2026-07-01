import { existsSync } from "node:fs";

import { topicTags } from "@/data/tags";
import { technologyItems } from "@/data/technologies";
import { buildFallbackImportedCandidates } from "@/lib/importers";
import { syncExternalImportedCandidates } from "@/lib/external-import";
import {
  evaluateTechnologyPublishReadiness,
  PublishReadinessError,
  type PublishReadinessResult
} from "@/lib/publish-readiness";
import {
  evaluateImportedCandidatePriority,
  evaluateTechnologyPriority
} from "@/lib/ranking";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import {
  tryRecordWorkflowError,
  tryRecordWorkflowEvent
} from "@/lib/workflow-events";
import {
  getPairKey,
  normalizeTitleForComparison
} from "@/lib/candidate-duplicate-rules";
import {
  analyzeDuplicates,
  readDuplicateGroupStore,
  writeDuplicateGroupStore
} from "@/lib/candidate-duplicate-store";
import {
  normalizeReadableText,
  stripMarkup,
  getPayloadText,
  trimReadableText,
  normalizeRequiredField,
  normalizeEditableText,
  normalizeStringList,
  normalizeStoredStringList,
  normalizeStringMap,
  normalizeStoredStringMap,
  normalizeReadingDifficulty,
  normalizeIntelligenceStatus,
  normalizeSlug,
  mergeLocalizedText,
} from "@/lib/workspace-record-normalizers";
import {
  normalizeTechnologyType,
  inferPublisherType,
  mapCandidateTagsToTopicTagIds,
  buildDraftText,
  buildDraftContent,
  buildCandidateSourceReference,
} from "@/lib/candidate-conversion-mapping";
import type {
  CandidateImportStatus,
  CandidateNormalizedType,
  CandidateSourceReference,
  DuplicateGroup,
  DuplicateGroupStatus,
  DuplicateReason,
  IntelligenceStatus,
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ImportedCandidateSourceRecord,
  LocalizedText,
  ImportanceLevel,
  PublisherType,
  ReadingDifficulty,
  SourceLanguage,
  TechnologyItem,
  TechnologyWorkspaceRecord,
  TechnologyType,
  TranslationStatus
} from "@/types/content";

interface CandidateReviewStateEntry {
  importStatus: CandidateImportStatus;
  reviewedAt?: string;
  convertedTechnologyId?: string;
}

interface CandidateReviewStateFile {
  updatedAt: string;
  items: Record<string, CandidateReviewStateEntry>;
}

interface TechnologyWorkspaceStore {
  updatedAt: string;
  records: TechnologyWorkspaceRecord[];
}

export interface DuplicateComparisonItem {
  candidate: ImportedCandidate;
  reasons: DuplicateReason[];
}

export interface TechnologyWorkspaceRecordUpdate {
  slug?: string;
  title?: LocalizedText;
  summary?: LocalizedText;
  content?: LocalizedText;
  type?: TechnologyType;
  publishDate?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceLanguage?: SourceLanguage;
  translationStatus?: TranslationStatus;
  publisherName?: string;
  publisherType?: PublisherType;
  importanceLevel?: ImportanceLevel;
  tags?: string[];
  relatedKnowledgeIds?: string[];
  relatedSkillIds?: string[];
  editorialNotes?: string[];
  whyItMatters?: string;
  whoShouldCare?: string[];
  technicalContext?: string;
  impactAreas?: string[];
  learningPath?: string[];
  relatedKnowledgeExplanations?: Record<string, string>;
  relatedSkillExplanations?: Record<string, string>;
  followUpQuestions?: string[];
  readingDifficulty?: ReadingDifficulty;
  intelligenceStatus?: IntelligenceStatus;
}

const importedCandidatesSnapshotPath = getLocalStoreFilePath(
  "imported-candidates.live.json"
);
const candidateReviewStatePath = getLocalStoreFilePath(
  "candidate-review-state.json"
);
const technologyWorkspaceStorePath = getLocalStoreFilePath(
  "technology-workspace.json"
);
const legacyTechnologyDraftStorePath = getLocalStoreFilePath(
  "technology-drafts.json"
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

function readImportedCandidateSnapshot(): ImportedCandidateSnapshot {
  const snapshot = readJsonFile(importedCandidatesSnapshotPath, buildFallbackSnapshot());

  return {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate) =>
      sanitizeImportedCandidate(candidate)
    )
  };
}

function writeImportedCandidateSnapshot(snapshot: ImportedCandidateSnapshot) {
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

function readCandidateReviewState(): CandidateReviewStateFile {
  return readJsonFile(candidateReviewStatePath, {
    updatedAt: new Date().toISOString(),
    items: {}
  });
}

function writeCandidateReviewState(state: CandidateReviewStateFile) {
  writeJsonFile(candidateReviewStatePath, state);
}

function normalizeTechnologyWorkspaceRecord(
  record: Record<string, unknown>
): TechnologyWorkspaceRecord {
  const rawStatus = record.status;
  const normalizedStatus: TechnologyItem["status"] =
    rawStatus === "published" || rawStatus === "archived" || rawStatus === "draft"
      ? rawStatus
      : "draft";

  return {
    ...(record as unknown as TechnologyItem),
    status: normalizedStatus,
    sourceCandidateId:
      (record.sourceCandidateId as string | undefined) ??
      (record.draftSourceCandidateId as string | undefined),
    sourceReferences:
      (record.sourceReferences as CandidateSourceReference[] | undefined) ?? [],
    createdAt:
      (record.createdAt as string | undefined) ?? new Date().toISOString(),
    updatedAt:
      (record.updatedAt as string | undefined) ?? new Date().toISOString(),
    editorialNotes:
      (record.editorialNotes as string[] | undefined) ??
      (record.draftNotes as string[] | undefined) ??
      [],
    whyItMatters:
      typeof record.whyItMatters === "string" ? record.whyItMatters : "",
    whoShouldCare: normalizeStoredStringList(record.whoShouldCare),
    technicalContext:
      typeof record.technicalContext === "string" ? record.technicalContext : "",
    impactAreas: normalizeStoredStringList(record.impactAreas),
    learningPath: normalizeStoredStringList(record.learningPath),
    relatedKnowledgeExplanations: normalizeStoredStringMap(
      record.relatedKnowledgeExplanations
    ),
    relatedSkillExplanations: normalizeStoredStringMap(
      record.relatedSkillExplanations
    ),
    followUpQuestions: normalizeStoredStringList(record.followUpQuestions),
    readingDifficulty: normalizeReadingDifficulty(record.readingDifficulty),
    intelligenceStatus: normalizeIntelligenceStatus(record.intelligenceStatus)
  };
}

function readTechnologyWorkspaceStore(): TechnologyWorkspaceStore {
  if (existsSync(technologyWorkspaceStorePath)) {
    const store = readJsonFile<TechnologyWorkspaceStore>(technologyWorkspaceStorePath, {
      updatedAt: new Date().toISOString(),
      records: []
    });

    return {
      updatedAt: store.updatedAt,
      records: store.records.map((record) =>
        normalizeTechnologyWorkspaceRecord(record as unknown as Record<string, unknown>)
      )
    };
  }

  if (existsSync(legacyTechnologyDraftStorePath)) {
    const legacyStore = readJsonFile<{
      updatedAt?: string;
      drafts?: Record<string, unknown>[];
    }>(legacyTechnologyDraftStorePath, {});

    return {
      updatedAt: legacyStore.updatedAt ?? new Date().toISOString(),
      records: (legacyStore.drafts ?? []).map((record) =>
        normalizeTechnologyWorkspaceRecord(record)
      )
    };
  }

  return {
    updatedAt: new Date().toISOString(),
    records: []
  };
}

function writeTechnologyWorkspaceStore(store: TechnologyWorkspaceStore) {
  writeJsonFile(technologyWorkspaceStorePath, store);
}

function applyReviewState(
  candidates: ImportedCandidate[],
  reviewState: CandidateReviewStateFile
): ImportedCandidate[] {
  return candidates.map((candidate) => {
    const state = reviewState.items[candidate.id];

    if (!state) {
      return {
        ...candidate,
        relatedCandidateIds: [...candidate.relatedCandidateIds]
      };
    }

    return {
      ...candidate,
      importStatus: state.importStatus,
      reviewedAt: state.reviewedAt,
      convertedTechnologyId: state.convertedTechnologyId,
      relatedCandidateIds: [...candidate.relatedCandidateIds]
    };
  });
}

function buildTechnologyWorkspaceRecord(
  candidate: ImportedCandidate,
  sourceReferences: CandidateSourceReference[] = []
): TechnologyWorkspaceRecord {
  const now = new Date().toISOString();
  const translationStatus: TranslationStatus =
    candidate.originalLanguage === "zh" ? "not_needed" : "pending";

  return {
    id: `draft-${candidate.id}`,
    slug: `draft-${normalizeTitleForComparison(candidate.originalTitle).replace(/\s+/g, "-")}`,
    title: buildDraftText(candidate.originalTitle, candidate.originalLanguage),
    summary: buildDraftText(
      candidate.originalSummary || candidate.originalTitle,
      candidate.originalLanguage
    ),
    content: buildDraftText(buildDraftContent(candidate), candidate.originalLanguage),
    type: normalizeTechnologyType(candidate.normalizedType),
    publishDate: candidate.publishDate,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    sourceLanguage: candidate.originalLanguage,
    translationStatus,
    publisherName: candidate.publisherName,
    publisherType: inferPublisherType(candidate),
    importanceLevel: "signal",
    status: "draft",
    tags: mapCandidateTagsToTopicTagIds(candidate),
    relatedKnowledgeIds: [],
    relatedSkillIds: [],
    sourceReferences,
    priority: evaluateImportedCandidatePriority(candidate, {
      additionalReferenceCount: sourceReferences.length
    }),
    whyItMatters: "",
    whoShouldCare: [],
    technicalContext: "",
    impactAreas: [],
    learningPath: [],
    relatedKnowledgeExplanations: {},
    relatedSkillExplanations: {},
    followUpQuestions: [],
    readingDifficulty: "intermediate",
    intelligenceStatus: "needs_enrichment",
    sourceCandidateId: candidate.id,
    createdAt: now,
    updatedAt: now,
    editorialNotes: [
      `Generated from imported candidate ${candidate.id}.`,
      "Review normalized type, publisher type, and related links before publishing."
    ]
  };
}

export function getCandidateWorkflowData(): {
  snapshot: ImportedCandidateSnapshot;
  candidates: ImportedCandidate[];
  workspaceRecords: TechnologyWorkspaceRecord[];
  duplicateGroups: DuplicateGroup[];
} {
  const snapshot = readImportedCandidateSnapshot();
  const reviewState = readCandidateReviewState();
  const workspaceRecords = readTechnologyWorkspaceStore().records;
  const enrichedCandidates = applyReviewState(snapshot.candidates, reviewState);
  const duplicateAnalysis = analyzeDuplicates(
    enrichedCandidates.map((candidate) => ({
      ...candidate,
      relatedCandidateIds: []
    }))
  );

  return {
    snapshot,
    candidates: duplicateAnalysis.candidates.sort((left, right) =>
      right.publishDate.localeCompare(left.publishDate)
    ),
    workspaceRecords,
    duplicateGroups: duplicateAnalysis.groups.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    )
  };
}

export function getImportedCandidates(): ImportedCandidate[] {
  return getCandidateWorkflowData().candidates;
}

export function getImportedCandidateById(id: string): ImportedCandidate | undefined {
  return getImportedCandidates().find((candidate) => candidate.id === id);
}

export function getDuplicateGroups(): DuplicateGroup[] {
  return getCandidateWorkflowData().duplicateGroups;
}

export function getDuplicateGroupById(
  groupId: string
): DuplicateGroup | undefined {
  return getDuplicateGroups().find((group) => group.id === groupId);
}

export function getDuplicateGroupCandidates(groupId: string): ImportedCandidate[] {
  const group = getDuplicateGroupById(groupId);
  const candidates = getImportedCandidates();

  if (!group) {
    return [];
  }

  return group.candidateIds
    .map((candidateId) => candidates.find((candidate) => candidate.id === candidateId))
    .filter((candidate): candidate is ImportedCandidate => Boolean(candidate));
}

function getDuplicateGroupForCandidate(
  candidateId: string
): DuplicateGroup | undefined {
  return getDuplicateGroups().find((group) =>
    group.candidateIds.includes(candidateId)
  );
}

export function updateDuplicateGroup(
  groupId: string,
  updates: {
    primaryCandidateId?: string;
    status?: DuplicateGroupStatus;
  }
): DuplicateGroup {
  const group = getDuplicateGroupById(groupId);

  if (!group) {
    throw new Error(`Duplicate group ${groupId} not found.`);
  }

  if (
    updates.primaryCandidateId &&
    !group.candidateIds.includes(updates.primaryCandidateId)
  ) {
    throw new Error("Primary candidate must belong to the duplicate group.");
  }

  const store = readDuplicateGroupStore();
  const nextGroup: DuplicateGroup = {
    ...group,
    primaryCandidateId: updates.primaryCandidateId ?? group.primaryCandidateId,
    status: updates.status ?? group.status,
    updatedAt: new Date().toISOString()
  };
  const existingGroups = store.groups.filter((item) => item.id !== groupId);

  writeDuplicateGroupStore({
    updatedAt: new Date().toISOString(),
    groups: [...existingGroups, nextGroup].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    )
  });

  tryRecordWorkflowEvent({
    entityType: "duplicate_group",
    entityId: nextGroup.id,
    action:
      group.status !== "resolved" && nextGroup.status === "resolved"
        ? "duplicate_group.resolved"
        : "duplicate_group.updated",
    actorType: "workspace_user",
    beforeSnapshot: group,
    afterSnapshot: nextGroup,
    metadata: {
      candidateIds: nextGroup.candidateIds,
      primaryCandidateId: nextGroup.primaryCandidateId
    }
  });

  return nextGroup;
}

export function getTechnologyWorkspaceRecords(): TechnologyWorkspaceRecord[] {
  return readTechnologyWorkspaceStore().records
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getTechnologyWorkspaceRecordById(
  id: string
): TechnologyWorkspaceRecord | undefined {
  return getTechnologyWorkspaceRecords().find((record) => record.id === id);
}

export function getTechnologyDrafts(): TechnologyWorkspaceRecord[] {
  return getTechnologyWorkspaceRecords();
}

export function getTechnologyDraftById(
  id: string
): TechnologyWorkspaceRecord | undefined {
  return getTechnologyWorkspaceRecordById(id);
}

export function getPublishedTechnologyWorkspaceRecords(): TechnologyWorkspaceRecord[] {
  return getTechnologyWorkspaceRecords().filter(
    (record) => record.status === "published"
  );
}

export function getTechnologyWorkspacePublishReadiness(
  recordId: string
): PublishReadinessResult {
  const store = readTechnologyWorkspaceStore();
  const record = store.records.find((item) => item.id === recordId);

  if (!record) {
    throw new Error(`Technology workspace record ${recordId} not found.`);
  }

  return evaluateTechnologyPublishReadiness(
    record,
    store.records,
    technologyItems
  );
}

export function getDuplicateComparisonsForCandidate(
  candidateId: string
): DuplicateComparisonItem[] {
  const { candidates } = getCandidateWorkflowData();
  const candidate = candidates.find((item) => item.id === candidateId);

  if (!candidate || candidate.relatedCandidateIds.length === 0) {
    return [];
  }

  const pairReasons = analyzeDuplicates(
    candidates.map((item) => ({
      ...item,
      relatedCandidateIds: [...item.relatedCandidateIds]
    }))
  ).pairReasons;

  return candidate.relatedCandidateIds
    .map((relatedCandidateId) => {
      const relatedCandidate = candidates.find((item) => item.id === relatedCandidateId);

      if (!relatedCandidate) {
        return undefined;
      }

      return {
        candidate: relatedCandidate,
        reasons: pairReasons[getPairKey(candidate.id, relatedCandidateId)] ?? []
      };
    })
    .filter((item): item is DuplicateComparisonItem => Boolean(item));
}

export async function syncImportedCandidateSnapshotFromLiveSources(): Promise<ImportedCandidateSnapshot> {
  const snapshot = await syncExternalImportedCandidates();

  writeImportedCandidateSnapshot(snapshot);

  return snapshot;
}

export function updateImportedCandidateStatus(
  candidateId: string,
  nextStatus: CandidateImportStatus
): CandidateReviewStateEntry {
  const state = readCandidateReviewState();
  const existingEntry = state.items[candidateId];
  const reviewedAt =
    nextStatus === "new" ? undefined : new Date().toISOString();

  state.items[candidateId] = {
    importStatus: nextStatus,
    reviewedAt,
    convertedTechnologyId: existingEntry?.convertedTechnologyId
  };
  state.updatedAt = new Date().toISOString();

  writeCandidateReviewState(state);

  tryRecordWorkflowEvent({
    entityType: "candidate",
    entityId: candidateId,
    action: "candidate.status_updated",
    actorType: "workspace_user",
    beforeSnapshot: existingEntry,
    afterSnapshot: state.items[candidateId],
    metadata: {
      nextStatus
    }
  });

  return state.items[candidateId];
}

export function updateTechnologyWorkspaceStatus(
  recordId: string,
  nextStatus: TechnologyItem["status"]
): TechnologyWorkspaceRecord {
  const store = readTechnologyWorkspaceStore();
  const existingRecord = store.records.find((record) => record.id === recordId);

  if (!existingRecord) {
    throw new Error(`Technology workspace record ${recordId} not found.`);
  }

  if (nextStatus === "published") {
    const readiness = evaluateTechnologyPublishReadiness(
      existingRecord,
      store.records,
      technologyItems
    );

    if (!readiness.isReady) {
      tryRecordWorkflowEvent({
        entityType: "technology_draft",
        entityId: recordId,
        action: "draft.publish_failed",
        actorType: "workspace_user",
        beforeSnapshot: existingRecord,
        metadata: {
          blockingErrors: readiness.blockingErrors.map((issue) => issue.code)
        }
      });
      throw new PublishReadinessError(readiness);
    }
  }

  const nextRecordWithoutRanking: TechnologyWorkspaceRecord = {
    ...existingRecord,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };
  const nextRecord: TechnologyWorkspaceRecord = {
    ...nextRecordWithoutRanking,
    priority: evaluateTechnologyPriority(nextRecordWithoutRanking)
  };

  store.records = [
    ...store.records.filter((record) => record.id !== recordId),
    nextRecord
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  store.updatedAt = new Date().toISOString();
  writeTechnologyWorkspaceStore(store);

  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: nextRecord.id,
    action: nextStatus === "published" ? "draft.published" : "draft.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingRecord,
    afterSnapshot: nextRecord,
    metadata: {
      status: nextStatus,
      slug: nextRecord.slug
    }
  });

  return nextRecord;
}

export function updateTechnologyWorkspaceRecord(
  recordId: string,
  updates: TechnologyWorkspaceRecordUpdate
): TechnologyWorkspaceRecord {
  const store = readTechnologyWorkspaceStore();
  const existingRecord = store.records.find((record) => record.id === recordId);

  if (!existingRecord) {
    throw new Error(`Technology workspace record ${recordId} not found.`);
  }

  const nextTitle = mergeLocalizedText(existingRecord.title, updates.title);
  const nextSummary = mergeLocalizedText(existingRecord.summary, updates.summary);
  const nextContent = mergeLocalizedText(existingRecord.content, updates.content);
  const nextRecordWithoutRanking: TechnologyWorkspaceRecord = {
    ...existingRecord,
    slug: normalizeSlug(updates.slug, nextTitle.original),
    title: nextTitle,
    summary: nextSummary,
    content: nextContent,
    type: updates.type ?? existingRecord.type,
    publishDate: normalizeRequiredField(
      updates.publishDate,
      existingRecord.publishDate
    ),
    sourceName: normalizeRequiredField(
      updates.sourceName,
      existingRecord.sourceName
    ),
    sourceUrl: normalizeRequiredField(updates.sourceUrl, existingRecord.sourceUrl),
    sourceLanguage: updates.sourceLanguage ?? existingRecord.sourceLanguage,
    translationStatus:
      updates.translationStatus ?? existingRecord.translationStatus,
    publisherName: normalizeRequiredField(
      updates.publisherName,
      existingRecord.publisherName
    ),
    publisherType: updates.publisherType ?? existingRecord.publisherType,
    importanceLevel: updates.importanceLevel ?? existingRecord.importanceLevel,
    tags: normalizeStringList(updates.tags) ?? existingRecord.tags,
    relatedKnowledgeIds:
      normalizeStringList(updates.relatedKnowledgeIds) ??
      existingRecord.relatedKnowledgeIds,
    relatedSkillIds:
      normalizeStringList(updates.relatedSkillIds) ??
      existingRecord.relatedSkillIds,
    editorialNotes:
      normalizeStringList(updates.editorialNotes) ?? existingRecord.editorialNotes,
    whyItMatters: normalizeEditableText(
      updates.whyItMatters,
      existingRecord.whyItMatters ?? ""
    ),
    whoShouldCare:
      normalizeStringList(updates.whoShouldCare) ??
      existingRecord.whoShouldCare ??
      [],
    technicalContext: normalizeEditableText(
      updates.technicalContext,
      existingRecord.technicalContext ?? ""
    ),
    impactAreas:
      normalizeStringList(updates.impactAreas) ?? existingRecord.impactAreas ?? [],
    learningPath:
      normalizeStringList(updates.learningPath) ?? existingRecord.learningPath ?? [],
    relatedKnowledgeExplanations:
      normalizeStringMap(updates.relatedKnowledgeExplanations) ??
      existingRecord.relatedKnowledgeExplanations ??
      {},
    relatedSkillExplanations:
      normalizeStringMap(updates.relatedSkillExplanations) ??
      existingRecord.relatedSkillExplanations ??
      {},
    followUpQuestions:
      normalizeStringList(updates.followUpQuestions) ??
      existingRecord.followUpQuestions ??
      [],
    readingDifficulty:
      updates.readingDifficulty ?? existingRecord.readingDifficulty,
    intelligenceStatus:
      updates.intelligenceStatus ??
      existingRecord.intelligenceStatus ??
      "needs_enrichment",
    updatedAt: new Date().toISOString()
  };
  const nextRecord: TechnologyWorkspaceRecord = {
    ...nextRecordWithoutRanking,
    priority: evaluateTechnologyPriority(nextRecordWithoutRanking)
  };

  store.records = [
    ...store.records.filter((record) => record.id !== recordId),
    nextRecord
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  store.updatedAt = new Date().toISOString();
  writeTechnologyWorkspaceStore(store);

  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: nextRecord.id,
    action: "draft.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingRecord,
    afterSnapshot: nextRecord,
    metadata: {
      slug: nextRecord.slug,
      status: nextRecord.status
    }
  });

  return nextRecord;
}

export function publishTechnologyWorkspaceRecord(
  recordId: string
): TechnologyWorkspaceRecord {
  return updateTechnologyWorkspaceStatus(recordId, "published");
}

export function getCandidateDraftConversionReadiness(candidateId: string): {
  canConvert: boolean;
  message?: string;
  duplicateGroup?: DuplicateGroup;
} {
  const candidate = getImportedCandidateById(candidateId);

  if (!candidate) {
    throw new Error(`Imported candidate ${candidateId} not found.`);
  }

  const duplicateGroup = getDuplicateGroupForCandidate(candidateId);

  if (!duplicateGroup || duplicateGroup.status === "ignored") {
    return { canConvert: true, duplicateGroup };
  }

  if (duplicateGroup.primaryCandidateId !== candidateId) {
    return {
      canConvert: false,
      duplicateGroup,
      message:
        "This candidate belongs to a duplicate group and is not the primary candidate. Resolve the group or convert the primary candidate instead."
    };
  }

  const groupCandidates = getDuplicateGroupCandidates(duplicateGroup.id);
  const convertedOtherCandidate = groupCandidates.find(
    (item) => item.id !== candidateId && item.convertedTechnologyId
  );

  if (convertedOtherCandidate) {
    return {
      canConvert: false,
      duplicateGroup,
      message:
        "This duplicate group already has a converted technology draft. Open the existing draft instead of creating another one."
    };
  }

  return { canConvert: true, duplicateGroup };
}

export function convertImportedCandidateToDraft(
  candidateId: string
): TechnologyWorkspaceRecord {
  const candidate = getImportedCandidateById(candidateId);

  if (!candidate) {
    throw new Error(`Imported candidate ${candidateId} not found.`);
  }

  if (candidate.convertedTechnologyId) {
    const existingConvertedRecord = getTechnologyWorkspaceRecordById(
      candidate.convertedTechnologyId
    );

    if (existingConvertedRecord) {
      return existingConvertedRecord;
    }
  }

  const conversionReadiness = getCandidateDraftConversionReadiness(candidateId);

  if (!conversionReadiness.canConvert) {
    const error = new Error(
      conversionReadiness.message ?? "Candidate cannot be converted to draft."
    );

    tryRecordWorkflowError({
      entityType: "candidate",
      entityId: candidateId,
      action: "candidate.convert_failed",
      actorType: "workspace_user",
      beforeSnapshot: candidate,
      error,
      metadata: {
        duplicateGroupId: conversionReadiness.duplicateGroup?.id
      }
    });

    throw error;
  }

  const additionalSourceReferences =
    conversionReadiness.duplicateGroup &&
    conversionReadiness.duplicateGroup.status !== "ignored"
      ? getDuplicateGroupCandidates(conversionReadiness.duplicateGroup.id)
          .filter((item) => item.id !== candidate.id)
          .map(buildCandidateSourceReference)
      : [];
  const store = readTechnologyWorkspaceStore();
  const draftId = `draft-${candidate.id}`;
  const existingRecord = store.records.find((record) => record.id === draftId);
  const nextRecord = buildTechnologyWorkspaceRecord(
    candidate,
    additionalSourceReferences
  );
  const mergedRecordBase: TechnologyWorkspaceRecord = existingRecord
    ? {
        ...existingRecord,
        ...nextRecord,
        status: existingRecord.status,
        createdAt: existingRecord.createdAt,
        editorialNotes: existingRecord.editorialNotes,
        updatedAt: new Date().toISOString()
      }
    : nextRecord;
  const mergedRecord: TechnologyWorkspaceRecord = {
    ...mergedRecordBase,
    priority: evaluateTechnologyPriority(mergedRecordBase)
  };

  store.records = [
    ...store.records.filter((record) => record.id !== draftId),
    mergedRecord
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  store.updatedAt = new Date().toISOString();
  writeTechnologyWorkspaceStore(store);

  const reviewState = readCandidateReviewState();
  const convertedAt = new Date().toISOString();
  const candidateIdsToMark =
    conversionReadiness.duplicateGroup &&
    conversionReadiness.duplicateGroup.status !== "ignored"
      ? conversionReadiness.duplicateGroup.candidateIds
      : [candidateId];

  for (const id of candidateIdsToMark) {
    reviewState.items[id] = {
      importStatus: "converted",
      reviewedAt: convertedAt,
      convertedTechnologyId: mergedRecord.id
    };
  }

  reviewState.updatedAt = new Date().toISOString();
  try {
    writeCandidateReviewState(reviewState);
  } catch (error) {
    writeTechnologyWorkspaceStore({
      ...store,
      records: existingRecord
        ? [
            ...store.records.filter((record) => record.id !== draftId),
            existingRecord
          ]
        : store.records.filter((record) => record.id !== draftId)
    });
    tryRecordWorkflowError({
      entityType: "candidate",
      entityId: candidateId,
      action: "candidate.convert_failed",
      actorType: "workspace_user",
      beforeSnapshot: candidate,
      error,
      metadata: {
        draftId
      }
    });
    throw error;
  }

  tryRecordWorkflowEvent({
    entityType: "candidate",
    entityId: candidateId,
    action: "candidate.converted_to_draft",
    actorType: "workspace_user",
    beforeSnapshot: candidate,
    afterSnapshot: mergedRecord,
    metadata: {
      draftId: mergedRecord.id,
      duplicateGroupId: conversionReadiness.duplicateGroup?.id,
      markedCandidateIds: candidateIdsToMark
    }
  });

  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: mergedRecord.id,
    action: "candidate.converted_to_draft",
    actorType: "workspace_user",
    beforeSnapshot: existingRecord,
    afterSnapshot: mergedRecord,
    metadata: {
      sourceCandidateId: candidateId
    }
  });

  return mergedRecord;
}
