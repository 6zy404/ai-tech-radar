import { randomUUID } from "node:crypto";

import { knowledgeItems } from "@/data/knowledge";
import { topicTags } from "@/data/tags";
import {
  PublishReadinessError,
  type PublishReadinessIssue,
  type PublishReadinessResult
} from "@/lib/publish-readiness";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  ContentWorkspaceOrigin,
  ContentWorkspaceStatus,
  DifficultyLevel,
  KnowledgeCategory,
  KnowledgeItem,
  KnowledgeWorkspaceRecord
} from "@/types/content";

export interface KnowledgeWorkspaceStore {
  updatedAt: string;
  records: KnowledgeWorkspaceRecord[];
}

export interface KnowledgeWorkspaceEntry {
  origin: ContentWorkspaceOrigin;
  status: ContentWorkspaceStatus;
  item: KnowledgeItem;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeWorkspaceUpdate {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  category?: KnowledgeCategory;
  difficulty?: DifficultyLevel;
  tags?: string[];
  relatedTechnologyIds?: string[];
  relatedSkillIds?: string[];
}

const knowledgeWorkspaceStorePath = getLocalStoreFilePath(
  "knowledge-workspace.json"
);

const knowledgeCategories: KnowledgeCategory[] = [
  "machine-learning",
  "software-architecture",
  "data",
  "product-thinking",
  "operations"
];
const difficultyLevels: DifficultyLevel[] = [
  "foundation",
  "intermediate",
  "advanced"
];

function getTimestamp(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeKnowledgeWorkspaceRecord(
  record: Record<string, unknown>
): KnowledgeWorkspaceRecord {
  const now = getTimestamp();

  return {
    id: normalizeText(record.id) || `knowledge-ws-${randomUUID().slice(0, 8)}`,
    title: normalizeText(record.title),
    slug: normalizeText(record.slug),
    summary: normalizeText(record.summary),
    content: typeof record.content === "string" ? record.content : "",
    category: knowledgeCategories.includes(record.category as KnowledgeCategory)
      ? (record.category as KnowledgeCategory)
      : "machine-learning",
    difficulty: difficultyLevels.includes(record.difficulty as DifficultyLevel)
      ? (record.difficulty as DifficultyLevel)
      : "foundation",
    tags: normalizeStringArray(record.tags),
    relatedTechnologyIds: normalizeStringArray(record.relatedTechnologyIds),
    relatedSkillIds: normalizeStringArray(record.relatedSkillIds),
    status: record.status === "published" ? "published" : "draft",
    createdAt: normalizeText(record.createdAt) || now,
    updatedAt: normalizeText(record.updatedAt) || now
  };
}

export function readKnowledgeWorkspaceStore(): KnowledgeWorkspaceStore {
  const store = readLocalJsonFile<KnowledgeWorkspaceStore>(
    knowledgeWorkspaceStorePath,
    { updatedAt: getTimestamp(), records: [] }
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    records: (store.records ?? []).map((record) =>
      normalizeKnowledgeWorkspaceRecord(
        record as unknown as Record<string, unknown>
      )
    )
  };
}

function writeKnowledgeWorkspaceStore(store: KnowledgeWorkspaceStore) {
  writeLocalJsonFile(knowledgeWorkspaceStorePath, {
    updatedAt: getTimestamp(),
    records: store.records
  });
}

function toKnowledgeItem(record: KnowledgeWorkspaceRecord): KnowledgeItem {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    summary: record.summary,
    content: record.content,
    category: record.category,
    difficulty: record.difficulty,
    tags: [...record.tags],
    relatedTechnologyIds: [...record.relatedTechnologyIds],
    relatedSkillIds: [...record.relatedSkillIds]
  };
}

/**
 * Pure core for the workspace list view: every seed knowledge item plus
 * every workspace record, with per-entry origin. Workspace entries first
 * (newest update first), untouched seeds after in seed order.
 */
export function buildKnowledgeWorkspaceEntries(
  seeds: KnowledgeItem[],
  records: KnowledgeWorkspaceRecord[]
): KnowledgeWorkspaceEntry[] {
  const seedIds = new Set(seeds.map((item) => item.id));
  const overriddenIds = new Set(
    records.filter((record) => seedIds.has(record.id)).map((r) => r.id)
  );

  const workspaceEntries: KnowledgeWorkspaceEntry[] = [...records]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((record) => ({
      origin: seedIds.has(record.id) ? "seed_override" : "workspace",
      status: record.status,
      item: toKnowledgeItem(record),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));

  const seedEntries: KnowledgeWorkspaceEntry[] = seeds
    .filter((item) => !overriddenIds.has(item.id))
    .map((item) => ({
      origin: "seed",
      status: "published",
      item
    }));

  return [...workspaceEntries, ...seedEntries];
}

export function getKnowledgeWorkspaceEntries(): KnowledgeWorkspaceEntry[] {
  return buildKnowledgeWorkspaceEntries(
    knowledgeItems,
    readKnowledgeWorkspaceStore().records
  );
}

export function getKnowledgeWorkspaceEntryById(
  id: string
): KnowledgeWorkspaceEntry | undefined {
  return getKnowledgeWorkspaceEntries().find((entry) => entry.item.id === id);
}

/**
 * Pure publish-readiness core. `otherSlugs` must be the slugs of every other
 * knowledge item (merged seeds + workspace records, excluding the record
 * itself).
 */
export function evaluateKnowledgePublishReadiness(
  record: KnowledgeItem,
  otherSlugs: string[],
  knownTagIds: Set<string>
): PublishReadinessResult {
  const blockingErrors: PublishReadinessIssue[] = [];
  const warnings: PublishReadinessIssue[] = [];
  const issue = (
    severity: PublishReadinessIssue["severity"],
    field: string,
    code: string,
    message: string
  ): PublishReadinessIssue => ({ severity, field, code, message });

  if (!record.title.trim()) {
    blockingErrors.push(
      issue("blocking", "title", "missing-title", "标题为必填项。")
    );
  }

  if (!record.slug.trim()) {
    blockingErrors.push(
      issue("blocking", "slug", "missing-slug", "Slug 为必填项。")
    );
  } else if (otherSlugs.includes(record.slug)) {
    blockingErrors.push(
      issue(
        "blocking",
        "slug",
        "duplicate-slug",
        `Slug「${record.slug}」已被其他知识条目使用。`
      )
    );
  }

  if (!record.summary.trim()) {
    blockingErrors.push(
      issue("blocking", "summary", "missing-summary", "摘要为必填项。")
    );
  }

  if (record.content.trim().length < 100) {
    warnings.push(
      issue("warning", "content", "short-content", "正文少于 100 字。")
    );
  }

  if (record.tags.length === 0) {
    warnings.push(
      issue("warning", "tags", "missing-tags", "尚未选择任何话题标签。")
    );
  } else {
    const unknownTags = record.tags.filter((tag) => !knownTagIds.has(tag));

    if (unknownTags.length > 0) {
      warnings.push(
        issue(
          "warning",
          "tags",
          "non-canonical-tags",
          `存在非规范标签：${unknownTags.join("、")}。`
        )
      );
    }
  }

  if (
    record.relatedTechnologyIds.length === 0 &&
    record.relatedSkillIds.length === 0
  ) {
    warnings.push(
      issue(
        "warning",
        "related",
        "missing-related-content",
        "尚未关联任何技术信号或技能。"
      )
    );
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    warnings
  };
}

function getOtherKnowledgeSlugs(recordId: string): string[] {
  return getKnowledgeWorkspaceEntries()
    .filter((entry) => entry.item.id !== recordId)
    .map((entry) => entry.item.slug);
}

export function getKnowledgePublishReadiness(
  id: string
): PublishReadinessResult {
  const entry = getKnowledgeWorkspaceEntryById(id);

  if (!entry) {
    throw new Error(`Knowledge workspace entry ${id} not found.`);
  }

  return evaluateKnowledgePublishReadiness(
    entry.item,
    getOtherKnowledgeSlugs(id),
    new Set(topicTags.map((tag) => tag.id))
  );
}

function applyKnowledgeUpdate(
  base: KnowledgeItem,
  update: KnowledgeWorkspaceUpdate
): KnowledgeItem {
  return {
    ...base,
    title: update.title !== undefined ? update.title.trim() : base.title,
    slug: update.slug !== undefined ? update.slug.trim() : base.slug,
    summary:
      update.summary !== undefined ? update.summary.trim() : base.summary,
    content: update.content !== undefined ? update.content : base.content,
    category:
      update.category !== undefined &&
      knowledgeCategories.includes(update.category)
        ? update.category
        : base.category,
    difficulty:
      update.difficulty !== undefined &&
      difficultyLevels.includes(update.difficulty)
        ? update.difficulty
        : base.difficulty,
    tags:
      update.tags !== undefined ? normalizeStringArray(update.tags) : base.tags,
    relatedTechnologyIds:
      update.relatedTechnologyIds !== undefined
        ? normalizeStringArray(update.relatedTechnologyIds)
        : base.relatedTechnologyIds,
    relatedSkillIds:
      update.relatedSkillIds !== undefined
        ? normalizeStringArray(update.relatedSkillIds)
        : base.relatedSkillIds
  };
}

function saveKnowledgeWorkspaceRecord(record: KnowledgeWorkspaceRecord) {
  const store = readKnowledgeWorkspaceStore();

  writeKnowledgeWorkspaceStore({
    updatedAt: getTimestamp(),
    records: [...store.records.filter((item) => item.id !== record.id), record]
  });
}

export function createKnowledgeWorkspaceRecord(
  update: KnowledgeWorkspaceUpdate
): KnowledgeWorkspaceRecord {
  const now = getTimestamp();
  const record = normalizeKnowledgeWorkspaceRecord({
    ...applyKnowledgeUpdate(
      {
        id: "",
        title: "",
        slug: "",
        summary: "",
        content: "",
        category: "machine-learning",
        difficulty: "foundation",
        tags: [],
        relatedTechnologyIds: [],
        relatedSkillIds: []
      },
      update
    ),
    id: `knowledge-ws-${randomUUID().slice(0, 8)}`,
    status: "draft",
    createdAt: now,
    updatedAt: now
  } as unknown as Record<string, unknown>);

  saveKnowledgeWorkspaceRecord(record);

  tryRecordWorkflowEvent({
    entityType: "knowledge",
    entityId: record.id,
    action: "knowledge.created",
    actorType: "workspace_user",
    afterSnapshot: record
  });

  return record;
}

/**
 * Updates a knowledge workspace record. Editing a seed item copies it into
 * the workspace store first (copy-on-write, initial status `published` since
 * the seed version is already live); the seed data file is never modified.
 */
export function updateKnowledgeWorkspaceRecord(
  id: string,
  update: KnowledgeWorkspaceUpdate
): KnowledgeWorkspaceRecord {
  const store = readKnowledgeWorkspaceStore();
  const existingRecord = store.records.find((record) => record.id === id);
  const seed = knowledgeItems.find((item) => item.id === id);

  if (!existingRecord && !seed) {
    throw new Error(`Knowledge workspace entry ${id} not found.`);
  }

  const now = getTimestamp();
  const base: KnowledgeWorkspaceRecord = existingRecord ?? {
    ...(seed as KnowledgeItem),
    status: "published",
    createdAt: now,
    updatedAt: now
  };
  const record: KnowledgeWorkspaceRecord = {
    ...base,
    ...applyKnowledgeUpdate(toKnowledgeItem(base), update),
    status: base.status,
    createdAt: base.createdAt,
    updatedAt: now
  };

  saveKnowledgeWorkspaceRecord(record);

  tryRecordWorkflowEvent({
    entityType: "knowledge",
    entityId: record.id,
    action: "knowledge.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingRecord ?? seed,
    afterSnapshot: record
  });

  return record;
}

/**
 * Publishes or unpublishes a knowledge workspace record. Publishing runs the
 * minimal publish gate; blocking errors throw `PublishReadinessError`.
 */
export function updateKnowledgeWorkspaceStatus(
  id: string,
  status: ContentWorkspaceStatus
): KnowledgeWorkspaceRecord {
  const store = readKnowledgeWorkspaceStore();
  const existingRecord = store.records.find((record) => record.id === id);
  const seed = knowledgeItems.find((item) => item.id === id);

  if (!existingRecord && !seed) {
    throw new Error(`Knowledge workspace entry ${id} not found.`);
  }

  const now = getTimestamp();
  const base: KnowledgeWorkspaceRecord = existingRecord ?? {
    ...(seed as KnowledgeItem),
    status: "published",
    createdAt: now,
    updatedAt: now
  };

  if (status === "published") {
    const readiness = evaluateKnowledgePublishReadiness(
      toKnowledgeItem(base),
      getOtherKnowledgeSlugs(id),
      new Set(topicTags.map((tag) => tag.id))
    );

    if (!readiness.isReady) {
      tryRecordWorkflowEvent({
        entityType: "knowledge",
        entityId: id,
        action: "knowledge.publish_failed",
        actorType: "workspace_user",
        metadata: {
          blockingErrors: readiness.blockingErrors.map((issue) => issue.code)
        }
      });
      throw new PublishReadinessError(readiness);
    }
  }

  const record: KnowledgeWorkspaceRecord = { ...base, status, updatedAt: now };

  saveKnowledgeWorkspaceRecord(record);

  tryRecordWorkflowEvent({
    entityType: "knowledge",
    entityId: record.id,
    action:
      status === "published" ? "knowledge.published" : "knowledge.updated",
    actorType: "workspace_user",
    beforeSnapshot: base,
    afterSnapshot: record,
    metadata: { status }
  });

  return record;
}

/**
 * Pure public-surface merge: workspace records override seeds by id (a
 * published record replaces the seed version; a draft record hides it), and
 * workspace-new records appear only once published. The returned items carry
 * no workspace-only fields.
 */
export function applyKnowledgeWorkspaceOverlay(
  base: KnowledgeItem[],
  records: KnowledgeWorkspaceRecord[]
): KnowledgeItem[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const baseIds = new Set(base.map((item) => item.id));

  const overlaidBase = base
    .map((item) => {
      const record = recordsById.get(item.id);

      if (!record) {
        return item;
      }

      return record.status === "published"
        ? toKnowledgeItem(record)
        : undefined;
    })
    .filter((item): item is KnowledgeItem => Boolean(item));

  const newPublished = records
    .filter(
      (record) => !baseIds.has(record.id) && record.status === "published"
    )
    .map(toKnowledgeItem);

  return [...overlaidBase, ...newPublished];
}

export function getMergedPublicKnowledge(
  base: KnowledgeItem[]
): KnowledgeItem[] {
  return applyKnowledgeWorkspaceOverlay(
    base,
    readKnowledgeWorkspaceStore().records
  );
}
