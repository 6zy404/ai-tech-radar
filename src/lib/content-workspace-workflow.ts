import { randomUUID } from "node:crypto";

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
  ContentWorkspaceStatus
} from "@/types/content";

/**
 * The shared workspace workflow behind skills and knowledge: a copy-on-write
 * overlay of workspace records over read-only seed items, with a minimal
 * publish gate. The two kinds differ only in their enum attributes (skill
 * type / heat / learning cost vs. category / difficulty), which list of
 * related ids they carry besides technologies, and two sentences of copy —
 * all of which live in the `ContentWorkspaceKind` passed in.
 */

/** Fields every skill and knowledge item has. */
export interface ContentWorkspaceBaseItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  tags: string[];
  relatedTechnologyIds: string[];
}

export type ContentWorkspaceRecordOf<TItem> = TItem & {
  status: ContentWorkspaceStatus;
  createdAt: string;
  updatedAt: string;
};

export interface ContentWorkspaceStoreOf<TItem> {
  updatedAt: string;
  records: ContentWorkspaceRecordOf<TItem>[];
}

export interface ContentWorkspaceEntryOf<TItem> {
  origin: ContentWorkspaceOrigin;
  status: ContentWorkspaceStatus;
  item: TItem;
  createdAt?: string;
  updatedAt?: string;
}

export type ContentWorkspaceUpdateOf<TItem> = Partial<Omit<TItem, "id">>;

/** An enum-valued attribute: stored values outside `values` read as `fallback`. */
export interface ContentWorkspaceAttribute<TItem> {
  key: keyof TItem & string;
  values: readonly string[];
  fallback: string;
}

export interface ContentWorkspaceKind<TItem extends ContentWorkspaceBaseItem> {
  /** Workflow event entity type, action prefix and id prefix. */
  entityType: "skill" | "knowledge";
  /** Used in not-found errors: `${errorLabel} workspace entry ${id} not found.` */
  errorLabel: string;
  storeFileName: string;
  seeds: TItem[];
  /** In the order they appear on the item (it is also the stored key order). */
  attributes: ContentWorkspaceAttribute<TItem>[];
  /** The second related-id list, after `relatedTechnologyIds`. */
  relatedIdsKey: keyof TItem & string;
  /** 「Slug「x」已被其他${duplicateSlugLabel}使用。」 */
  duplicateSlugLabel: string;
  /** 「尚未关联任何技术信号或${missingRelatedLabel}。」 */
  missingRelatedLabel: string;
}

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

export function createContentWorkspaceWorkflow<
  TItem extends ContentWorkspaceBaseItem
>(kind: ContentWorkspaceKind<TItem>) {
  type TRecord = ContentWorkspaceRecordOf<TItem>;
  type TEntry = ContentWorkspaceEntryOf<TItem>;
  type TUpdate = ContentWorkspaceUpdateOf<TItem>;
  type TStore = ContentWorkspaceStoreOf<TItem>;

  const storePath = getLocalStoreFilePath(kind.storeFileName);
  const relatedKey = kind.relatedIdsKey;
  const newId = () => `${kind.entityType}-ws-${randomUUID().slice(0, 8)}`;

  function readAttribute(
    attribute: ContentWorkspaceAttribute<TItem>,
    value: unknown
  ): string {
    return attribute.values.includes(value as string)
      ? (value as string)
      : attribute.fallback;
  }

  // Every item-shaped object below is built in one key order — the order the
  // seed files and the stored JSON use: identity and text, the kind's
  // attributes, tags, then the two related-id lists.
  function buildItem(
    source: Record<string, unknown>,
    readValue: (attribute: ContentWorkspaceAttribute<TItem>) => unknown,
    readList: (key: string) => string[]
  ): Record<string, unknown> {
    const item: Record<string, unknown> = {
      id: source.id,
      title: source.title,
      slug: source.slug,
      summary: source.summary,
      content: source.content
    };

    for (const attribute of kind.attributes) {
      item[attribute.key] = readValue(attribute);
    }

    item.tags = readList("tags");
    item.relatedTechnologyIds = readList("relatedTechnologyIds");
    item[relatedKey] = readList(relatedKey);

    return item;
  }

  function normalizeRecord(record: Record<string, unknown>): TRecord {
    const now = getTimestamp();
    const item = buildItem(
      {
        id: normalizeText(record.id) || newId(),
        title: normalizeText(record.title),
        slug: normalizeText(record.slug),
        summary: normalizeText(record.summary),
        content: typeof record.content === "string" ? record.content : ""
      },
      (attribute) => readAttribute(attribute, record[attribute.key]),
      (key) => normalizeStringArray(record[key])
    );

    return {
      ...item,
      status: record.status === "published" ? "published" : "draft",
      createdAt: normalizeText(record.createdAt) || now,
      updatedAt: normalizeText(record.updatedAt) || now
    } as unknown as TRecord;
  }

  function readStore(): TStore {
    const store = readLocalJsonFile<TStore>(storePath, {
      updatedAt: getTimestamp(),
      records: []
    });

    return {
      updatedAt: store.updatedAt ?? getTimestamp(),
      records: (store.records ?? []).map((record) =>
        normalizeRecord(record as unknown as Record<string, unknown>)
      )
    };
  }

  function writeStore(store: TStore) {
    writeLocalJsonFile(storePath, {
      updatedAt: getTimestamp(),
      records: store.records
    });
  }

  function toItem(record: TRecord | TItem): TItem {
    const source = record as unknown as Record<string, unknown>;

    return buildItem(
      source,
      (attribute) => source[attribute.key],
      (key) => [...(source[key] as string[])]
    ) as unknown as TItem;
  }

  /**
   * Pure core for the workspace list view: every seed item plus every
   * workspace record, with per-entry origin (workspace-new, untouched seed, or
   * seed overridden by a workspace copy). Workspace entries first (newest
   * update first), untouched seeds after in seed order.
   */
  function buildEntries(seeds: TItem[], records: TRecord[]): TEntry[] {
    const seedIds = new Set(seeds.map((item) => item.id));
    const overriddenIds = new Set(
      records.filter((record) => seedIds.has(record.id)).map((r) => r.id)
    );

    const workspaceEntries: TEntry[] = [...records]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => ({
        origin: seedIds.has(record.id) ? "seed_override" : "workspace",
        status: record.status,
        item: toItem(record),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }));

    const seedEntries: TEntry[] = seeds
      .filter((item) => !overriddenIds.has(item.id))
      .map((item) => ({
        origin: "seed",
        status: "published",
        item
      }));

    return [...workspaceEntries, ...seedEntries];
  }

  function getEntries(): TEntry[] {
    return buildEntries(kind.seeds, readStore().records);
  }

  function getEntryById(id: string): TEntry | undefined {
    return getEntries().find((entry) => entry.item.id === id);
  }

  /**
   * Pure publish-readiness core. `otherSlugs` must be the slugs of every other
   * item of this kind (merged seeds + workspace records, excluding the record
   * itself).
   */
  function evaluatePublishReadiness(
    record: TItem,
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
          `Slug「${record.slug}」已被其他${kind.duplicateSlugLabel}使用。`
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
      (record[relatedKey] as string[]).length === 0
    ) {
      warnings.push(
        issue(
          "warning",
          "related",
          "missing-related-content",
          `尚未关联任何技术信号或${kind.missingRelatedLabel}。`
        )
      );
    }

    return {
      isReady: blockingErrors.length === 0,
      blockingErrors,
      warnings
    };
  }

  function getOtherSlugs(recordId: string): string[] {
    return getEntries()
      .filter((entry) => entry.item.id !== recordId)
      .map((entry) => entry.item.slug);
  }

  const notFound = (id: string) =>
    new Error(`${kind.errorLabel} workspace entry ${id} not found.`);

  function getPublishReadiness(id: string): PublishReadinessResult {
    const entry = getEntryById(id);

    if (!entry) {
      throw notFound(id);
    }

    return evaluatePublishReadiness(
      entry.item,
      getOtherSlugs(id),
      new Set(topicTags.map((tag) => tag.id))
    );
  }

  function applyUpdate(base: TItem, update: TUpdate): TItem {
    const source = base as unknown as Record<string, unknown>;
    const changes = update as unknown as Record<string, unknown>;
    const text = (key: string) =>
      changes[key] !== undefined
        ? (changes[key] as string).trim()
        : source[key];
    const next: Record<string, unknown> = {
      ...source,
      title: text("title"),
      slug: text("slug"),
      summary: text("summary"),
      content: changes.content !== undefined ? changes.content : source.content
    };

    for (const attribute of kind.attributes) {
      const value = changes[attribute.key];

      next[attribute.key] =
        value !== undefined && attribute.values.includes(value as string)
          ? value
          : source[attribute.key];
    }

    for (const key of ["tags", "relatedTechnologyIds", relatedKey]) {
      next[key] =
        changes[key] !== undefined
          ? normalizeStringArray(changes[key])
          : source[key];
    }

    return next as unknown as TItem;
  }

  function saveRecord(record: TRecord) {
    const store = readStore();

    writeStore({
      updatedAt: getTimestamp(),
      records: [
        ...store.records.filter((item) => item.id !== record.id),
        record
      ]
    });
  }

  function createRecord(update: TUpdate): TRecord {
    const now = getTimestamp();
    const empty = buildItem(
      { id: "", title: "", slug: "", summary: "", content: "" },
      (attribute) => attribute.fallback,
      () => []
    ) as unknown as TItem;
    const record = normalizeRecord({
      ...applyUpdate(empty, update),
      id: newId(),
      status: "draft",
      createdAt: now,
      updatedAt: now
    } as unknown as Record<string, unknown>);

    saveRecord(record);

    tryRecordWorkflowEvent({
      entityType: kind.entityType,
      entityId: record.id,
      action: `${kind.entityType}.created`,
      actorType: "workspace_user",
      afterSnapshot: record
    });

    return record;
  }

  /** The stored record, or a fresh published copy of the seed (copy-on-write). */
  function resolveBase(id: string) {
    const store = readStore();
    const existingRecord = store.records.find((record) => record.id === id);
    const seed = kind.seeds.find((item) => item.id === id);

    if (!existingRecord && !seed) {
      throw notFound(id);
    }

    const now = getTimestamp();
    const base: TRecord =
      existingRecord ??
      ({
        ...(seed as TItem),
        status: "published",
        createdAt: now,
        updatedAt: now
      } as TRecord);

    return { existingRecord, seed, base, now };
  }

  /**
   * Updates a workspace record. Editing a seed item copies it into the
   * workspace store first (copy-on-write, initial status `published` since
   * the seed version is already live); the seed data file is never modified.
   */
  function updateRecord(id: string, update: TUpdate): TRecord {
    const { existingRecord, seed, base, now } = resolveBase(id);
    const record: TRecord = {
      ...base,
      ...applyUpdate(toItem(base), update),
      status: base.status,
      createdAt: base.createdAt,
      updatedAt: now
    };

    saveRecord(record);

    tryRecordWorkflowEvent({
      entityType: kind.entityType,
      entityId: record.id,
      action: `${kind.entityType}.updated`,
      actorType: "workspace_user",
      beforeSnapshot: existingRecord ?? seed,
      afterSnapshot: record
    });

    return record;
  }

  /**
   * Publishes or unpublishes a workspace record. Publishing runs the minimal
   * publish gate; blocking errors throw `PublishReadinessError`.
   */
  function updateStatus(id: string, status: ContentWorkspaceStatus): TRecord {
    const { base, now } = resolveBase(id);

    if (status === "published") {
      const readiness = evaluatePublishReadiness(
        toItem(base),
        getOtherSlugs(id),
        new Set(topicTags.map((tag) => tag.id))
      );

      if (!readiness.isReady) {
        tryRecordWorkflowEvent({
          entityType: kind.entityType,
          entityId: id,
          action: `${kind.entityType}.publish_failed`,
          actorType: "workspace_user",
          metadata: {
            blockingErrors: readiness.blockingErrors.map((issue) => issue.code)
          }
        });
        throw new PublishReadinessError(readiness);
      }
    }

    const record: TRecord = { ...base, status, updatedAt: now };

    saveRecord(record);

    tryRecordWorkflowEvent({
      entityType: kind.entityType,
      entityId: record.id,
      action:
        status === "published"
          ? `${kind.entityType}.published`
          : `${kind.entityType}.updated`,
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
   * workspace-new records appear only once published. The returned items
   * carry no workspace-only fields.
   */
  function applyOverlay(base: TItem[], records: TRecord[]): TItem[] {
    const recordsById = new Map(records.map((record) => [record.id, record]));
    const baseIds = new Set(base.map((item) => item.id));

    const overlaidBase = base
      .map((item) => {
        const record = recordsById.get(item.id);

        if (!record) {
          return item;
        }

        return record.status === "published" ? toItem(record) : undefined;
      })
      .filter((item): item is TItem => Boolean(item));

    const newPublished = records
      .filter(
        (record) => !baseIds.has(record.id) && record.status === "published"
      )
      .map(toItem);

    return [...overlaidBase, ...newPublished];
  }

  function getMergedPublic(base: TItem[]): TItem[] {
    return applyOverlay(base, readStore().records);
  }

  return {
    readStore,
    buildEntries,
    getEntries,
    getEntryById,
    evaluatePublishReadiness,
    getPublishReadiness,
    createRecord,
    updateRecord,
    updateStatus,
    applyOverlay,
    getMergedPublic
  };
}
