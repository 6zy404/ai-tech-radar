import { randomUUID } from "node:crypto";

import { radarEntries } from "@/data/radar";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "@/lib/content";
import {
  PublishReadinessError,
  type PublishReadinessIssue,
  type PublishReadinessResult
} from "@/lib/publish-readiness";
import { isRadarQuadrant, isRadarRing } from "@/lib/radar-labels";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type { ContentWorkspaceOrigin } from "@/types/content";
import type {
  RadarEntry,
  RadarQuadrant,
  RadarRing,
  RadarRingChange,
  RadarWorkspaceRecord,
  RadarWorkspaceStatus,
  RadarWorkspaceStore
} from "@/types/radar";

// The radar's workspace overlay, built the way the skill and knowledge
// consoles are (src/lib/content-workspace-workflow.ts): the seed entries in
// src/data/radar.ts are read-only, an edit copies a seed into
// config/radar-workspace.json first, and the public read merges the two.
// What is new here is the ring history: every create and every ring change
// appends a line, so 「本期新进 / 移动」 can be derived instead of stored.

export const radarWorkspaceStoreFileName = "radar-workspace.json";

const storePath = getLocalStoreFilePath(radarWorkspaceStoreFileName);
const entityType = "radar_entry";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface RadarWorkspaceEntry {
  origin: ContentWorkspaceOrigin;
  status: RadarWorkspaceStatus;
  entry: RadarEntry;
  createdAt?: string;
  updatedAt?: string;
}

/** What an editor may change. History is never set directly. */
export interface RadarWorkspaceUpdate {
  name?: string;
  slug?: string;
  quadrant?: RadarQuadrant;
  ring?: RadarRing;
  ringReason?: string;
  evidenceTechnologyIds?: string[];
  relatedKnowledgeIds?: string[];
  relatedSkillIds?: string[];
  /**
   * Why the ring changed, for the history line. Falls back to the ring
   * reason when empty. Ignored when the ring does not change.
   */
  changeReason?: string;
}

/** Ids the publish gate checks references against. */
export interface RadarReferencePools {
  technologyIds: Set<string>;
  knowledgeIds: Set<string>;
  skillIds: Set<string>;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

/** Today in Asia/Shanghai, YYYY-MM-DD — the date a history line carries. */
export function getRadarToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

function normalizeHistory(value: unknown, ring: RadarRing): RadarRingChange[] {
  const lines = Array.isArray(value)
    ? value
        .filter(
          (line): line is Record<string, unknown> =>
            Boolean(line) && typeof line === "object"
        )
        .filter(
          (line) =>
            typeof line.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(line.date) &&
            isRadarRing(line.toRing)
        )
        .map((line): RadarRingChange => ({
          date: line.date as string,
          ...(isRadarRing(line.fromRing) ? { fromRing: line.fromRing } : {}),
          toRing: line.toRing as RadarRing,
          reason: normalizeText(line.reason)
        }))
    : [];

  // A record without a usable history still has to say when it came in.
  return lines.length > 0
    ? lines
    : [{ date: getRadarToday(), toRing: ring, reason: "" }];
}

/** Key order matches the seed file and the stored JSON. */
function toEntry(source: RadarEntry): RadarEntry {
  return {
    id: source.id,
    name: source.name,
    slug: source.slug,
    quadrant: source.quadrant,
    ring: source.ring,
    ringReason: source.ringReason,
    evidenceTechnologyIds: [...source.evidenceTechnologyIds],
    relatedKnowledgeIds: [...source.relatedKnowledgeIds],
    relatedSkillIds: [...source.relatedSkillIds],
    history: source.history.map((line) => ({ ...line }))
  };
}

function normalizeRecord(
  record: Record<string, unknown>
): RadarWorkspaceRecord {
  const now = getTimestamp();
  const ring = isRadarRing(record.ring) ? record.ring : "assess";

  return {
    ...toEntry({
      id: normalizeText(record.id) || `radar-ws-${randomUUID().slice(0, 8)}`,
      name: normalizeText(record.name),
      slug: normalizeText(record.slug),
      quadrant: isRadarQuadrant(record.quadrant)
        ? record.quadrant
        : "tools-methods",
      ring,
      ringReason: normalizeText(record.ringReason),
      evidenceTechnologyIds: normalizeIds(record.evidenceTechnologyIds),
      relatedKnowledgeIds: normalizeIds(record.relatedKnowledgeIds),
      relatedSkillIds: normalizeIds(record.relatedSkillIds),
      history: normalizeHistory(record.history, ring)
    }),
    status: record.status === "published" ? "published" : "draft",
    createdAt: normalizeText(record.createdAt) || now,
    updatedAt: normalizeText(record.updatedAt) || now
  };
}

export function readRadarWorkspaceStore(): RadarWorkspaceStore {
  const store = readLocalJsonFile<RadarWorkspaceStore>(storePath, {
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

function saveRecord(record: RadarWorkspaceRecord) {
  const store = readRadarWorkspaceStore();

  writeLocalJsonFile(storePath, {
    updatedAt: getTimestamp(),
    records: [...store.records.filter((item) => item.id !== record.id), record]
  });
}

/**
 * Pure core of the console list: workspace records first (newest update
 * first), then the untouched seeds in seed order.
 */
export function buildRadarWorkspaceEntries(
  seeds: RadarEntry[],
  records: RadarWorkspaceRecord[]
): RadarWorkspaceEntry[] {
  const seedIds = new Set(seeds.map((entry) => entry.id));
  const recordIds = new Set(records.map((record) => record.id));

  return [
    ...[...records]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record): RadarWorkspaceEntry => ({
        origin: seedIds.has(record.id) ? "seed_override" : "workspace",
        status: record.status,
        entry: toEntry(record),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })),
    ...seeds
      .filter((entry) => !recordIds.has(entry.id))
      .map((entry): RadarWorkspaceEntry => ({
        origin: "seed",
        status: "published",
        entry
      }))
  ];
}

export function getRadarWorkspaceEntries(): RadarWorkspaceEntry[] {
  return buildRadarWorkspaceEntries(
    radarEntries,
    readRadarWorkspaceStore().records
  );
}

export function getRadarWorkspaceEntryById(
  id: string
): RadarWorkspaceEntry | undefined {
  return getRadarWorkspaceEntries().find((item) => item.entry.id === id);
}

/** Pure publish gate. `otherSlugs` excludes the entry itself. */
export function evaluateRadarPublishReadiness(
  entry: RadarEntry,
  otherSlugs: string[],
  pools: RadarReferencePools
): PublishReadinessResult {
  const blockingErrors: PublishReadinessIssue[] = [];
  const warnings: PublishReadinessIssue[] = [];
  const issue = (
    severity: PublishReadinessIssue["severity"],
    field: string,
    code: string,
    message: string
  ): PublishReadinessIssue => ({ severity, field, code, message });

  if (!entry.name.trim()) {
    blockingErrors.push(
      issue("blocking", "name", "missing-name", "名称为必填项。")
    );
  }

  if (!entry.slug.trim()) {
    blockingErrors.push(
      issue("blocking", "slug", "missing-slug", "Slug 为必填项。")
    );
  } else if (!slugPattern.test(entry.slug)) {
    blockingErrors.push(
      issue(
        "blocking",
        "slug",
        "invalid-slug",
        "Slug 只能用小写字母、数字和连字符。"
      )
    );
  } else if (otherSlugs.includes(entry.slug)) {
    blockingErrors.push(
      issue(
        "blocking",
        "slug",
        "duplicate-slug",
        `Slug「${entry.slug}」已被其他雷达条目使用。`
      )
    );
  }

  if (!entry.ringReason.trim()) {
    blockingErrors.push(
      issue(
        "blocking",
        "ringReason",
        "missing-ring-reason",
        "环位理由为必填项。"
      )
    );
  }

  const publishedEvidence = entry.evidenceTechnologyIds.filter((id) =>
    pools.technologyIds.has(id)
  );
  const missingEvidence =
    entry.evidenceTechnologyIds.length - publishedEvidence.length;

  if (publishedEvidence.length === 0) {
    blockingErrors.push(
      issue(
        "blocking",
        "evidenceTechnologyIds",
        "missing-evidence",
        "至少要有一条已发布的技术信号作为依据。"
      )
    );
  } else if (publishedEvidence.length < 2) {
    warnings.push(
      issue(
        "warning",
        "evidenceTechnologyIds",
        "thin-evidence",
        "只有一条依据信号，环位理由最好有 2–4 条信号支撑。"
      )
    );
  } else if (publishedEvidence.length > 4) {
    warnings.push(
      issue(
        "warning",
        "evidenceTechnologyIds",
        "too-much-evidence",
        `依据信号有 ${publishedEvidence.length} 条，挑最能说明环位的 2–4 条。`
      )
    );
  }

  if (missingEvidence > 0) {
    warnings.push(
      issue(
        "warning",
        "evidenceTechnologyIds",
        "unpublished-evidence",
        `${missingEvidence} 条依据不是已发布的信号，公开页不会显示。`
      )
    );
  }

  const unknownRelated = [
    ...entry.relatedKnowledgeIds.filter((id) => !pools.knowledgeIds.has(id)),
    ...entry.relatedSkillIds.filter((id) => !pools.skillIds.has(id))
  ];

  if (unknownRelated.length > 0) {
    warnings.push(
      issue(
        "warning",
        "related",
        "unpublished-related",
        `${unknownRelated.length} 条相关知识或技能未发布，公开页不会显示。`
      )
    );
  }

  if (
    entry.relatedKnowledgeIds.length === 0 &&
    entry.relatedSkillIds.length === 0
  ) {
    warnings.push(
      issue("warning", "related", "missing-related", "尚未关联任何知识或技能。")
    );
  }

  return { isReady: blockingErrors.length === 0, blockingErrors, warnings };
}

function loadReferencePools(): RadarReferencePools {
  return {
    technologyIds: new Set(getAllTechnologies().map((item) => item.id)),
    knowledgeIds: new Set(getAllKnowledge().map((item) => item.id)),
    skillIds: new Set(getAllSkills().map((item) => item.id))
  };
}

function getOtherSlugs(id: string): string[] {
  return getRadarWorkspaceEntries()
    .filter((item) => item.entry.id !== id)
    .map((item) => item.entry.slug);
}

const notFound = (id: string) =>
  new Error(`Radar workspace entry ${id} not found.`);

export function getRadarPublishReadiness(id: string): PublishReadinessResult {
  const item = getRadarWorkspaceEntryById(id);

  if (!item) {
    throw notFound(id);
  }

  return evaluateRadarPublishReadiness(
    item.entry,
    getOtherSlugs(id),
    loadReferencePools()
  );
}

/**
 * Pure: the entry after an edit. A changed ring appends one history line
 * dated `today`; an unchanged ring leaves history alone, whatever else
 * changed. History itself is never taken from the update.
 */
export function applyRadarUpdate(
  base: RadarEntry,
  update: RadarWorkspaceUpdate,
  today: string
): RadarEntry {
  const text = (value: string | undefined, fallback: string) =>
    value !== undefined ? value.trim() : fallback;
  const ring =
    update.ring !== undefined && isRadarRing(update.ring)
      ? update.ring
      : base.ring;
  const ringReason = text(update.ringReason, base.ringReason);
  const history = base.history.map((line) => ({ ...line }));

  if (ring !== base.ring) {
    history.push({
      date: today,
      fromRing: base.ring,
      toRing: ring,
      reason: update.changeReason?.trim() || ringReason
    });
  }

  return {
    id: base.id,
    name: text(update.name, base.name),
    slug: text(update.slug, base.slug),
    quadrant:
      update.quadrant !== undefined && isRadarQuadrant(update.quadrant)
        ? update.quadrant
        : base.quadrant,
    ring,
    ringReason,
    evidenceTechnologyIds:
      update.evidenceTechnologyIds !== undefined
        ? normalizeIds(update.evidenceTechnologyIds)
        : [...base.evidenceTechnologyIds],
    relatedKnowledgeIds:
      update.relatedKnowledgeIds !== undefined
        ? normalizeIds(update.relatedKnowledgeIds)
        : [...base.relatedKnowledgeIds],
    relatedSkillIds:
      update.relatedSkillIds !== undefined
        ? normalizeIds(update.relatedSkillIds)
        : [...base.relatedSkillIds],
    history
  };
}

export function createRadarWorkspaceRecord(
  update: RadarWorkspaceUpdate
): RadarWorkspaceRecord {
  const now = getTimestamp();
  const today = getRadarToday();
  const ring = update.ring && isRadarRing(update.ring) ? update.ring : "assess";
  const draft = applyRadarUpdate(
    {
      id: `radar-ws-${randomUUID().slice(0, 8)}`,
      name: "",
      slug: "",
      quadrant: "tools-methods",
      ring,
      ringReason: "",
      evidenceTechnologyIds: [],
      relatedKnowledgeIds: [],
      relatedSkillIds: [],
      history: []
    },
    { ...update, ring },
    today
  );
  const record: RadarWorkspaceRecord = {
    ...draft,
    history: [
      {
        date: today,
        toRing: ring,
        reason: update.changeReason?.trim() || draft.ringReason || "收录。"
      }
    ],
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  saveRecord(record);

  tryRecordWorkflowEvent({
    entityType,
    entityId: record.id,
    action: `${entityType}.created`,
    actorType: "workspace_user",
    afterSnapshot: record
  });

  return record;
}

/** The stored record, or a fresh published copy of the seed. */
function resolveBase(id: string) {
  const existingRecord = readRadarWorkspaceStore().records.find(
    (record) => record.id === id
  );
  const seed = radarEntries.find((entry) => entry.id === id);

  if (!existingRecord && !seed) {
    throw notFound(id);
  }

  const now = getTimestamp();
  const base: RadarWorkspaceRecord = existingRecord ?? {
    ...toEntry(seed as RadarEntry),
    status: "published",
    createdAt: now,
    updatedAt: now
  };

  return { existingRecord, seed, base, now };
}

/**
 * Edits an entry. Editing a seed copies it into the workspace store first
 * (status `published`, as the seed already is); the seed file is never
 * written. A ring change appends a history line and records its own event.
 */
export function updateRadarWorkspaceRecord(
  id: string,
  update: RadarWorkspaceUpdate
): RadarWorkspaceRecord {
  const { existingRecord, seed, base, now } = resolveBase(id);
  const record: RadarWorkspaceRecord = {
    ...applyRadarUpdate(base, update, getRadarToday()),
    status: base.status,
    createdAt: base.createdAt,
    updatedAt: now
  };

  saveRecord(record);

  tryRecordWorkflowEvent({
    entityType,
    entityId: record.id,
    action: `${entityType}.updated`,
    actorType: "workspace_user",
    beforeSnapshot: existingRecord ?? seed,
    afterSnapshot: record
  });

  if (record.ring !== base.ring) {
    tryRecordWorkflowEvent({
      entityType,
      entityId: record.id,
      action: `${entityType}.ring_changed`,
      actorType: "workspace_user",
      metadata: {
        fromRing: base.ring,
        toRing: record.ring,
        reason: record.history[record.history.length - 1]?.reason
      }
    });
  }

  return record;
}

/** Publishes (behind the gate) or unpublishes an entry. */
export function updateRadarWorkspaceStatus(
  id: string,
  status: RadarWorkspaceStatus
): RadarWorkspaceRecord {
  const { base, now } = resolveBase(id);

  if (status === "published") {
    const readiness = evaluateRadarPublishReadiness(
      toEntry(base),
      getOtherSlugs(id),
      loadReferencePools()
    );

    if (!readiness.isReady) {
      tryRecordWorkflowEvent({
        entityType,
        entityId: id,
        action: `${entityType}.publish_failed`,
        actorType: "workspace_user",
        metadata: {
          blockingErrors: readiness.blockingErrors.map((issue) => issue.code)
        }
      });
      throw new PublishReadinessError(readiness);
    }
  }

  const record: RadarWorkspaceRecord = { ...base, status, updatedAt: now };

  saveRecord(record);

  tryRecordWorkflowEvent({
    entityType,
    entityId: record.id,
    action:
      status === "published"
        ? `${entityType}.published`
        : `${entityType}.updated`,
    actorType: "workspace_user",
    beforeSnapshot: base,
    afterSnapshot: record,
    metadata: { status }
  });

  return record;
}

/**
 * Pure public merge: a published record replaces its seed, a draft record
 * hides it, a workspace-new record shows only once published. The result
 * carries no workspace status or timestamps.
 */
export function applyRadarWorkspaceOverlay(
  seeds: RadarEntry[],
  records: RadarWorkspaceRecord[]
): RadarEntry[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const seedIds = new Set(seeds.map((entry) => entry.id));

  return [
    ...seeds.flatMap((entry) => {
      const record = recordsById.get(entry.id);

      if (!record) {
        return [toEntry(entry)];
      }

      return record.status === "published" ? [toEntry(record)] : [];
    }),
    ...records
      .filter(
        (record) => !seedIds.has(record.id) && record.status === "published"
      )
      .map(toEntry)
  ];
}

export function getMergedPublicRadarEntries(): RadarEntry[] {
  return applyRadarWorkspaceOverlay(
    radarEntries,
    readRadarWorkspaceStore().records
  );
}
