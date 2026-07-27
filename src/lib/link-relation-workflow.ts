import { randomUUID } from "node:crypto";

import { linkRelations } from "@/data/relations";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import {
  getRelationDefaultKey,
  type RelationDefaultsMap
} from "@/lib/relation-defaults";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type { ContentKind, LinkRelation, RelationType } from "@/types/content";

export interface LinkRelationWorkspaceStore {
  updatedAt: string;
  relations: LinkRelation[];
}

export interface LinkRelationTargetUpdate {
  toId: string;
  toType: ContentKind;
  relationType: RelationType;
  note?: string;
}

const linkRelationWorkspaceStorePath = getLocalStoreFilePath(
  "link-relation-workspace.json"
);

const relationTypes: RelationType[] = [
  "builds-on",
  "uses",
  "explains",
  "requires",
  "extends",
  "supersedes",
  "supports",
  "related-to"
];
const contentKinds: ContentKind[] = ["technology", "skill", "knowledge"];

function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Unordered pair key: the same key regardless of which side a
 * `LinkRelation` records as `from`/`to`.
 */
export function getRelationPairKey(
  aId: string,
  aType: ContentKind,
  bId: string,
  bType: ContentKind
): string {
  const left = `${aType}:${aId}`;
  const right = `${bType}:${bId}`;

  return left <= right ? `${left}::${right}` : `${right}::${left}`;
}

function getPairKeyOf(relation: LinkRelation): string {
  return getRelationPairKey(
    relation.fromId,
    relation.fromType,
    relation.toId,
    relation.toType
  );
}

function normalizeRelation(
  record: Record<string, unknown>
): LinkRelation | undefined {
  const fromId = typeof record.fromId === "string" ? record.fromId : "";
  const toId = typeof record.toId === "string" ? record.toId : "";
  const fromType = record.fromType as ContentKind;
  const toType = record.toType as ContentKind;

  if (
    !fromId ||
    !toId ||
    !contentKinds.includes(fromType) ||
    !contentKinds.includes(toType) ||
    !relationTypes.includes(record.relationType as RelationType)
  ) {
    return undefined;
  }

  const note = typeof record.note === "string" ? record.note.trim() : "";

  return {
    id:
      typeof record.id === "string" && record.id
        ? record.id
        : `rel-ws-${randomUUID().slice(0, 8)}`,
    fromId,
    fromType,
    toId,
    toType,
    relationType: record.relationType as RelationType,
    ...(note ? { note } : {})
  };
}

export function readLinkRelationWorkspaceStore(): LinkRelationWorkspaceStore {
  const store = readLocalJsonFile<LinkRelationWorkspaceStore>(
    linkRelationWorkspaceStorePath,
    { updatedAt: getTimestamp(), relations: [] }
  );

  return {
    updatedAt: store.updatedAt ?? getTimestamp(),
    relations: (store.relations ?? [])
      .map((record) =>
        normalizeRelation(record as unknown as Record<string, unknown>)
      )
      .filter((relation): relation is LinkRelation => Boolean(relation))
  };
}

function writeLinkRelationWorkspaceStore(relations: LinkRelation[]) {
  writeLocalJsonFile(linkRelationWorkspaceStorePath, {
    updatedAt: getTimestamp(),
    relations
  });
}

/**
 * Pure merge core: workspace overrides win over seed relations per
 * unordered pair; seed entries without an override pass through unchanged.
 */
export function applyLinkRelationOverlay(
  seeds: LinkRelation[],
  overrides: LinkRelation[]
): LinkRelation[] {
  const overriddenPairs = new Set(overrides.map(getPairKeyOf));

  return [
    ...seeds.filter((relation) => !overriddenPairs.has(getPairKeyOf(relation))),
    ...overrides
  ];
}

export function getAllLinkRelations(): LinkRelation[] {
  return applyLinkRelationOverlay(
    linkRelations,
    readLinkRelationWorkspaceStore().relations
  );
}

/**
 * Pure lookup over an explicit relation list — the batch-friendly core
 * behind `findRelationBetween` in `content.ts`.
 */
export function findRelationIn(
  relations: LinkRelation[],
  aId: string,
  aType: ContentKind,
  bId: string,
  bType: ContentKind,
  defaultRelationType: RelationType = "related-to"
): { relationType: RelationType; note?: string } {
  const pairKey = getRelationPairKey(aId, aType, bId, bType);
  const relation = relations.find((item) => getPairKeyOf(item) === pairKey);

  return {
    relationType: relation?.relationType ?? defaultRelationType,
    note: relation?.note
  };
}

/**
 * Builds the prefill map for the workspace relation editors: for one source
 * entity, the current merged relation value against every offered
 * related-content option. Options without an explicit relation entry are
 * omitted (the form falls back to the generic default).
 */
export function buildRelationDefaults(
  from: { id: string; type: ContentKind },
  targets: { id: string; type: ContentKind }[]
): RelationDefaultsMap {
  const relations = getAllLinkRelations();
  const defaults: RelationDefaultsMap = {};

  for (const target of targets) {
    const pairKey = getRelationPairKey(
      from.id,
      from.type,
      target.id,
      target.type
    );
    const relation = relations.find((item) => getPairKeyOf(item) === pairKey);

    if (relation) {
      defaults[getRelationDefaultKey(target.type, target.id)] = {
        relationType: relation.relationType,
        ...(relation.note ? { note: relation.note } : {})
      };
    }
  }

  return defaults;
}

/**
 * Pure sync core: computes the next override list for one entity's edited
 * relation targets. Per target pair, the desired value is compared against
 * the seed relation for that pair:
 *
 * - equal to the seed (same type and note) → any override is removed, the
 *   seed carries the pair again (clean copy-on-write revert)
 * - the generic default (`related-to`, empty note) with no seed entry →
 *   any override is removed, nothing worth persisting
 * - anything else → an override entry is written (reusing the existing
 *   override id for the pair when one exists)
 *
 * Pairs not mentioned in `targets` are left untouched, including overrides
 * created from the other side of a shared pair.
 */
export function planLinkRelationSync(
  seeds: LinkRelation[],
  currentOverrides: LinkRelation[],
  from: { id: string; type: ContentKind },
  targets: LinkRelationTargetUpdate[]
): { nextOverrides: LinkRelation[]; changedPairKeys: string[] } {
  const seedsByPair = new Map(
    seeds.map((relation) => [getPairKeyOf(relation), relation])
  );
  const overridesByPair = new Map(
    currentOverrides.map((relation) => [getPairKeyOf(relation), relation])
  );
  const changedPairKeys: string[] = [];

  for (const target of targets) {
    if (
      !target.toId ||
      !contentKinds.includes(target.toType) ||
      !relationTypes.includes(target.relationType)
    ) {
      continue;
    }

    const pairKey = getRelationPairKey(
      from.id,
      from.type,
      target.toId,
      target.toType
    );
    const note = target.note?.trim() ?? "";
    const seed = seedsByPair.get(pairKey);
    const existingOverride = overridesByPair.get(pairKey);
    const matchesSeed =
      seed !== undefined &&
      seed.relationType === target.relationType &&
      (seed.note ?? "") === note;
    const isEmptyDefault =
      seed === undefined && target.relationType === "related-to" && !note;

    if (matchesSeed || isEmptyDefault) {
      if (existingOverride) {
        overridesByPair.delete(pairKey);
        changedPairKeys.push(pairKey);
      }
      continue;
    }

    if (
      existingOverride &&
      existingOverride.relationType === target.relationType &&
      (existingOverride.note ?? "") === note
    ) {
      continue;
    }

    overridesByPair.set(pairKey, {
      id: existingOverride?.id ?? `rel-ws-${randomUUID().slice(0, 8)}`,
      fromId: from.id,
      fromType: from.type,
      toId: target.toId,
      toType: target.toType,
      relationType: target.relationType,
      ...(note ? { note } : {})
    });
    changedPairKeys.push(pairKey);
  }

  return { nextOverrides: [...overridesByPair.values()], changedPairKeys };
}

/**
 * Applies one entity's edited relation targets to the workspace override
 * store (copy-on-write over the read-only seed relations in
 * `src/data/relations.ts`). Returns the number of changed pairs.
 */
export function syncLinkRelationsForEntity(
  from: { id: string; type: ContentKind },
  targets: LinkRelationTargetUpdate[]
): number {
  if (!contentKinds.includes(from.type) || !from.id) {
    throw new Error("A valid relation source entity is required.");
  }

  const store = readLinkRelationWorkspaceStore();
  const { nextOverrides, changedPairKeys } = planLinkRelationSync(
    linkRelations,
    store.relations,
    from,
    targets
  );

  if (changedPairKeys.length === 0) {
    return 0;
  }

  writeLinkRelationWorkspaceStore(nextOverrides);

  tryRecordWorkflowEvent({
    entityType: "link_relation",
    entityId: `${from.type}:${from.id}`,
    action: "link_relation.updated",
    actorType: "workspace_user",
    metadata: { changedPairKeys }
  });

  return changedPairKeys.length;
}
