import { technologyItems } from "@/data/technologies";
import {
  evaluateTechnologyPublishReadiness,
  PublishReadinessError,
  type PublishReadinessResult
} from "@/lib/publish-readiness";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  readTechnologyWorkspaceStore,
  writeTechnologyWorkspaceStore
} from "@/lib/candidate-technology-workspace-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import {
  normalizeRequiredField,
  normalizeEditableText,
  normalizeStringList,
  normalizeStringMap,
  normalizeSlug,
  mergeLocalizedText
} from "@/lib/workspace-record-normalizers";
import type {
  ImportanceLevel,
  IntelligenceStatus,
  LocalizedText,
  PublisherType,
  ReadingDifficulty,
  SourceLanguage,
  TechnologyItem,
  TechnologyType,
  TechnologyWorkspaceRecord,
  TranslationStatus
} from "@/types/content";

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
  relatedTechnologyIds?: string[];
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

export function getTechnologyWorkspaceRecords(): TechnologyWorkspaceRecord[] {
  return readTechnologyWorkspaceStore()
    .records.slice()
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
  const nextSummary = mergeLocalizedText(
    existingRecord.summary,
    updates.summary
  );
  const nextContent = mergeLocalizedText(
    existingRecord.content,
    updates.content
  );
  const nextRecordWithoutRanking: TechnologyWorkspaceRecord = {
    ...existingRecord,
    // A partial update without a slug keeps the existing slug — never
    // silently regenerate a public URL from the title.
    slug:
      updates.slug !== undefined
        ? normalizeSlug(updates.slug, nextTitle.original)
        : existingRecord.slug,
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
    sourceUrl: normalizeRequiredField(
      updates.sourceUrl,
      existingRecord.sourceUrl
    ),
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
    // Technology-to-technology links. A record must never reference itself,
    // which would render as a self-edge on /network and the detail-page graph.
    relatedTechnologyIds: (
      normalizeStringList(updates.relatedTechnologyIds) ??
      existingRecord.relatedTechnologyIds ??
      []
    ).filter((id) => id !== existingRecord.id),
    editorialNotes:
      normalizeStringList(updates.editorialNotes) ??
      existingRecord.editorialNotes,
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
      normalizeStringList(updates.impactAreas) ??
      existingRecord.impactAreas ??
      [],
    learningPath:
      normalizeStringList(updates.learningPath) ??
      existingRecord.learningPath ??
      [],
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
