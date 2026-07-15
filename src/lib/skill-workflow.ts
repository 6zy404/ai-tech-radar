import { randomUUID } from "node:crypto";

import { skillItems } from "@/data/skills";
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
  HeatLevel,
  LearningCost,
  SkillItem,
  SkillType,
  SkillWorkspaceRecord
} from "@/types/content";

export interface SkillWorkspaceStore {
  updatedAt: string;
  records: SkillWorkspaceRecord[];
}

export interface SkillWorkspaceEntry {
  origin: ContentWorkspaceOrigin;
  status: ContentWorkspaceStatus;
  item: SkillItem;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillWorkspaceUpdate {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  skillType?: SkillType;
  heatLevel?: HeatLevel;
  learningCost?: LearningCost;
  tags?: string[];
  relatedTechnologyIds?: string[];
  relatedKnowledgeIds?: string[];
}

const skillWorkspaceStorePath = getLocalStoreFilePath("skill-workspace.json");

const skillTypes: SkillType[] = [
  "engineering",
  "analysis",
  "product",
  "operations",
  "communication"
];
const heatLevels: HeatLevel[] = ["emerging", "active", "hot"];
const learningCosts: LearningCost[] = ["low", "medium", "high"];

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

function normalizeSkillWorkspaceRecord(
  record: Record<string, unknown>
): SkillWorkspaceRecord {
  const now = getTimestamp();

  return {
    id: normalizeText(record.id) || `skill-ws-${randomUUID().slice(0, 8)}`,
    title: normalizeText(record.title),
    slug: normalizeText(record.slug),
    summary: normalizeText(record.summary),
    content: typeof record.content === "string" ? record.content : "",
    skillType: skillTypes.includes(record.skillType as SkillType)
      ? (record.skillType as SkillType)
      : "engineering",
    heatLevel: heatLevels.includes(record.heatLevel as HeatLevel)
      ? (record.heatLevel as HeatLevel)
      : "active",
    learningCost: learningCosts.includes(record.learningCost as LearningCost)
      ? (record.learningCost as LearningCost)
      : "medium",
    tags: normalizeStringArray(record.tags),
    relatedTechnologyIds: normalizeStringArray(record.relatedTechnologyIds),
    relatedKnowledgeIds: normalizeStringArray(record.relatedKnowledgeIds),
    status: record.status === "published" ? "published" : "draft",
    createdAt: normalizeText(record.createdAt) || now,
    updatedAt: normalizeText(record.updatedAt) || now
  };
}

export function readSkillWorkspaceStore(): SkillWorkspaceStore {
  const store = readLocalJsonFile<SkillWorkspaceStore>(
    skillWorkspaceStorePath,
    { updatedAt: getTimestamp(), records: [] }
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    records: (store.records ?? []).map((record) =>
      normalizeSkillWorkspaceRecord(
        record as unknown as Record<string, unknown>
      )
    )
  };
}

function writeSkillWorkspaceStore(store: SkillWorkspaceStore) {
  writeLocalJsonFile(skillWorkspaceStorePath, {
    updatedAt: getTimestamp(),
    records: store.records
  });
}

function toSkillItem(record: SkillWorkspaceRecord): SkillItem {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    summary: record.summary,
    content: record.content,
    skillType: record.skillType,
    heatLevel: record.heatLevel,
    learningCost: record.learningCost,
    tags: [...record.tags],
    relatedTechnologyIds: [...record.relatedTechnologyIds],
    relatedKnowledgeIds: [...record.relatedKnowledgeIds]
  };
}

/**
 * Pure core for the workspace list view: every seed skill plus every
 * workspace record, with per-entry origin (workspace-new, untouched seed, or
 * seed overridden by a workspace copy). Workspace entries first (newest
 * update first), untouched seeds after in seed order.
 */
export function buildSkillWorkspaceEntries(
  seeds: SkillItem[],
  records: SkillWorkspaceRecord[]
): SkillWorkspaceEntry[] {
  const seedIds = new Set(seeds.map((item) => item.id));
  const overriddenIds = new Set(
    records.filter((record) => seedIds.has(record.id)).map((r) => r.id)
  );

  const workspaceEntries: SkillWorkspaceEntry[] = [...records]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((record) => ({
      origin: seedIds.has(record.id) ? "seed_override" : "workspace",
      status: record.status,
      item: toSkillItem(record),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));

  const seedEntries: SkillWorkspaceEntry[] = seeds
    .filter((item) => !overriddenIds.has(item.id))
    .map((item) => ({
      origin: "seed",
      status: "published",
      item
    }));

  return [...workspaceEntries, ...seedEntries];
}

export function getSkillWorkspaceEntries(): SkillWorkspaceEntry[] {
  return buildSkillWorkspaceEntries(
    skillItems,
    readSkillWorkspaceStore().records
  );
}

export function getSkillWorkspaceEntryById(
  id: string
): SkillWorkspaceEntry | undefined {
  return getSkillWorkspaceEntries().find((entry) => entry.item.id === id);
}

/**
 * Pure publish-readiness core. `otherSlugs` must be the slugs of every other
 * skill (merged seeds + workspace records, excluding the record itself).
 */
export function evaluateSkillPublishReadiness(
  record: SkillItem,
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
        `Slug「${record.slug}」已被其他技能条目使用。`
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
    record.relatedKnowledgeIds.length === 0
  ) {
    warnings.push(
      issue(
        "warning",
        "related",
        "missing-related-content",
        "尚未关联任何技术信号或知识。"
      )
    );
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    warnings
  };
}

function getOtherSkillSlugs(recordId: string): string[] {
  return getSkillWorkspaceEntries()
    .filter((entry) => entry.item.id !== recordId)
    .map((entry) => entry.item.slug);
}

export function getSkillPublishReadiness(id: string): PublishReadinessResult {
  const entry = getSkillWorkspaceEntryById(id);

  if (!entry) {
    throw new Error(`Skill workspace entry ${id} not found.`);
  }

  return evaluateSkillPublishReadiness(
    entry.item,
    getOtherSkillSlugs(id),
    new Set(topicTags.map((tag) => tag.id))
  );
}

function applySkillUpdate(
  base: SkillItem,
  update: SkillWorkspaceUpdate
): SkillItem {
  return {
    ...base,
    title: update.title !== undefined ? update.title.trim() : base.title,
    slug: update.slug !== undefined ? update.slug.trim() : base.slug,
    summary:
      update.summary !== undefined ? update.summary.trim() : base.summary,
    content: update.content !== undefined ? update.content : base.content,
    skillType:
      update.skillType !== undefined && skillTypes.includes(update.skillType)
        ? update.skillType
        : base.skillType,
    heatLevel:
      update.heatLevel !== undefined && heatLevels.includes(update.heatLevel)
        ? update.heatLevel
        : base.heatLevel,
    learningCost:
      update.learningCost !== undefined &&
      learningCosts.includes(update.learningCost)
        ? update.learningCost
        : base.learningCost,
    tags:
      update.tags !== undefined ? normalizeStringArray(update.tags) : base.tags,
    relatedTechnologyIds:
      update.relatedTechnologyIds !== undefined
        ? normalizeStringArray(update.relatedTechnologyIds)
        : base.relatedTechnologyIds,
    relatedKnowledgeIds:
      update.relatedKnowledgeIds !== undefined
        ? normalizeStringArray(update.relatedKnowledgeIds)
        : base.relatedKnowledgeIds
  };
}

function saveSkillWorkspaceRecord(record: SkillWorkspaceRecord) {
  const store = readSkillWorkspaceStore();

  writeSkillWorkspaceStore({
    updatedAt: getTimestamp(),
    records: [...store.records.filter((item) => item.id !== record.id), record]
  });
}

export function createSkillWorkspaceRecord(
  update: SkillWorkspaceUpdate
): SkillWorkspaceRecord {
  const now = getTimestamp();
  const record = normalizeSkillWorkspaceRecord({
    ...applySkillUpdate(
      {
        id: "",
        title: "",
        slug: "",
        summary: "",
        content: "",
        skillType: "engineering",
        heatLevel: "active",
        learningCost: "medium",
        tags: [],
        relatedTechnologyIds: [],
        relatedKnowledgeIds: []
      },
      update
    ),
    id: `skill-ws-${randomUUID().slice(0, 8)}`,
    status: "draft",
    createdAt: now,
    updatedAt: now
  } as unknown as Record<string, unknown>);

  saveSkillWorkspaceRecord(record);

  tryRecordWorkflowEvent({
    entityType: "skill",
    entityId: record.id,
    action: "skill.created",
    actorType: "workspace_user",
    afterSnapshot: record
  });

  return record;
}

/**
 * Updates a skill workspace record. Editing a seed skill copies it into the
 * workspace store first (copy-on-write, initial status `published` since the
 * seed version is already live); the seed data file is never modified.
 */
export function updateSkillWorkspaceRecord(
  id: string,
  update: SkillWorkspaceUpdate
): SkillWorkspaceRecord {
  const store = readSkillWorkspaceStore();
  const existingRecord = store.records.find((record) => record.id === id);
  const seed = skillItems.find((item) => item.id === id);

  if (!existingRecord && !seed) {
    throw new Error(`Skill workspace entry ${id} not found.`);
  }

  const now = getTimestamp();
  const base: SkillWorkspaceRecord = existingRecord ?? {
    ...(seed as SkillItem),
    status: "published",
    createdAt: now,
    updatedAt: now
  };
  const record: SkillWorkspaceRecord = {
    ...base,
    ...applySkillUpdate(toSkillItem(base), update),
    status: base.status,
    createdAt: base.createdAt,
    updatedAt: now
  };

  saveSkillWorkspaceRecord(record);

  tryRecordWorkflowEvent({
    entityType: "skill",
    entityId: record.id,
    action: "skill.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingRecord ?? seed,
    afterSnapshot: record
  });

  return record;
}

/**
 * Publishes or unpublishes a skill workspace record. Publishing runs the
 * minimal publish gate; blocking errors throw `PublishReadinessError`.
 */
export function updateSkillWorkspaceStatus(
  id: string,
  status: ContentWorkspaceStatus
): SkillWorkspaceRecord {
  const store = readSkillWorkspaceStore();
  const existingRecord = store.records.find((record) => record.id === id);
  const seed = skillItems.find((item) => item.id === id);

  if (!existingRecord && !seed) {
    throw new Error(`Skill workspace entry ${id} not found.`);
  }

  const now = getTimestamp();
  const base: SkillWorkspaceRecord = existingRecord ?? {
    ...(seed as SkillItem),
    status: "published",
    createdAt: now,
    updatedAt: now
  };

  if (status === "published") {
    const readiness = evaluateSkillPublishReadiness(
      toSkillItem(base),
      getOtherSkillSlugs(id),
      new Set(topicTags.map((tag) => tag.id))
    );

    if (!readiness.isReady) {
      tryRecordWorkflowEvent({
        entityType: "skill",
        entityId: id,
        action: "skill.publish_failed",
        actorType: "workspace_user",
        metadata: {
          blockingErrors: readiness.blockingErrors.map((issue) => issue.code)
        }
      });
      throw new PublishReadinessError(readiness);
    }
  }

  const record: SkillWorkspaceRecord = { ...base, status, updatedAt: now };

  saveSkillWorkspaceRecord(record);

  tryRecordWorkflowEvent({
    entityType: "skill",
    entityId: record.id,
    action: status === "published" ? "skill.published" : "skill.updated",
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
export function applySkillWorkspaceOverlay(
  base: SkillItem[],
  records: SkillWorkspaceRecord[]
): SkillItem[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const baseIds = new Set(base.map((item) => item.id));

  const overlaidBase = base
    .map((item) => {
      const record = recordsById.get(item.id);

      if (!record) {
        return item;
      }

      return record.status === "published" ? toSkillItem(record) : undefined;
    })
    .filter((item): item is SkillItem => Boolean(item));

  const newPublished = records
    .filter(
      (record) => !baseIds.has(record.id) && record.status === "published"
    )
    .map(toSkillItem);

  return [...overlaidBase, ...newPublished];
}

export function getMergedPublicSkills(base: SkillItem[]): SkillItem[] {
  return applySkillWorkspaceOverlay(base, readSkillWorkspaceStore().records);
}
