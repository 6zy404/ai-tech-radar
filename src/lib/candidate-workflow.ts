import { syncExternalImportedCandidates } from "@/lib/external-import";
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
  readTechnologyWorkspaceStore,
  writeTechnologyWorkspaceStore
} from "@/lib/candidate-technology-workspace-store";
import { getTechnologyWorkspaceRecordById } from "@/lib/technology-draft-workflow";
import {
  readImportedCandidateSnapshot,
  writeImportedCandidateSnapshot
} from "@/lib/candidate-import-snapshot-store";
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
  CandidateSourceReference,
  DuplicateGroup,
  DuplicateGroupStatus,
  DuplicateReason,
  ImportedCandidate,
  ImportedCandidateSnapshot,
  TechnologyWorkspaceRecord,
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

export interface DuplicateComparisonItem {
  candidate: ImportedCandidate;
  reasons: DuplicateReason[];
}

const candidateReviewStatePath = getLocalStoreFilePath(
  "candidate-review-state.json"
);

function readCandidateReviewState(): CandidateReviewStateFile {
  return readJsonFile(candidateReviewStatePath, {
    updatedAt: new Date().toISOString(),
    items: {}
  });
}

function writeCandidateReviewState(state: CandidateReviewStateFile) {
  writeJsonFile(candidateReviewStatePath, state);
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
