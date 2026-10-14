import { knowledgeItems } from "@/data/knowledge";
import { skillItems } from "@/data/skills";
import { topicTags } from "@/data/tags";
import {
  getImportedCandidateById as getImportedCandidateFromWorkflow,
  getImportedCandidates as getImportedCandidatesFromWorkflow
} from "@/lib/candidate-workflow";
import {
  getPublishedTechnologyWorkspaceRecords,
  getTechnologyDraftById,
  getTechnologyDrafts,
  getTechnologyWorkspaceRecordById,
  getTechnologyWorkspaceRecords
} from "@/lib/technology-draft-workflow";
import { technologyItems } from "@/data/technologies";
import {
  getLocalStoreFingerprint,
  getStoreRevision
} from "@/lib/repositories/local-json-store";
import {
  getPersistenceDriver,
  readSqliteKnowledgeItems,
  readSqliteSeedTechnologies,
  readSqliteSkillItems
} from "@/lib/repositories/sqlite-store";
import { getMergedPublicKnowledge } from "@/lib/knowledge-workflow";
import {
  findRelationIn,
  getAllLinkRelations
} from "@/lib/link-relation-workflow";
import { getMergedPublicSkills } from "@/lib/skill-workflow";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type {
  ContentKind,
  ImportedCandidate,
  KnowledgeItem,
  LinkRelation,
  RelationListItem,
  RelationType,
  SkillItem,
  TechnologyItem,
  TechnologyWorkspaceRecord,
  TopicTag
} from "@/types/content";

const contentPathMap: Record<ContentKind, string> = {
  technology: "/technologies",
  skill: "/skills",
  knowledge: "/knowledge"
};

/**
 * The stores the three public pools are merged from, memoized per store
 * revision.
 *
 * Why: `resolveTitle` and `resolveSlug` each call one of the `getAllX()`
 * getters and then `.find()` the single item they want, and every caller of
 * those resolvers is a per-item loop — `getContentGraph` runs both for **every
 * node**. Measured 2026-08-18 on `/network`: 72 nodes × 2 resolvers = 144 full
 * reads of `technology-workspace.json` (524 KB, 2.6ms each) plus the skill and
 * knowledge overlays, which is the whole of that page's 355-382ms inside
 * `getContentGraph`. Same family as the `/workspace` block fixed the day
 * before: a whole-store read sitting inside a per-item helper.
 *
 * The memo is on the **source reads**, not on the returned pools, so each
 * getter still builds and sorts a fresh array and no caller can mutate another
 * caller's copy. The key is the same two-part one the candidate cache uses —
 * an in-process write counter plus a file fingerprint, so a write from the
 * task runner invalidates it too.
 */
function memoizePerStoreRevision<T>(load: () => T): () => T {
  let cached: { key: string; value: T } | undefined;

  return () => {
    const key = `${getStoreRevision()}::${getLocalStoreFingerprint(
      contentPoolSources
    )}`;

    if (cached?.key === key) {
      return cached.value;
    }

    const value = load();
    cached = { key, value };

    return value;
  };
}

const contentPoolSources = [
  "technology-workspace.json",
  "skill-workspace.json",
  "knowledge-workspace.json"
];

const loadPublishedTechnologyRecords = memoizePerStoreRevision(() =>
  getPublishedTechnologyWorkspaceRecords()
);

const loadMergedSkills = memoizePerStoreRevision(() =>
  getMergedPublicSkills(
    getPersistenceDriver() === "sqlite" ? readSqliteSkillItems() : skillItems
  )
);

const loadMergedKnowledge = memoizePerStoreRevision(() =>
  getMergedPublicKnowledge(
    getPersistenceDriver() === "sqlite"
      ? readSqliteKnowledgeItems()
      : knowledgeItems
  )
);

export function getAllTechnologies(): TechnologyItem[] {
  const seedTechnologies =
    getPersistenceDriver() === "sqlite"
      ? readSqliteSeedTechnologies()
      : technologyItems;

  return [
    ...seedTechnologies
      .filter((item) => item.status === "published")
      .map(withoutTechnologyPriorityInternals),
    ...loadPublishedTechnologyRecords().map(toUserFacingTechnologyItem)
  ].sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}

export function getAllImportedCandidates(): ImportedCandidate[] {
  return getImportedCandidatesFromWorkflow();
}

export function getAllSkills(): SkillItem[] {
  return [...loadMergedSkills()];
}

export function getAllKnowledge(): KnowledgeItem[] {
  return [...loadMergedKnowledge()];
}

export function getAllTags(): TopicTag[] {
  return topicTags;
}

export function getTechnologyBySlug(slug: string): TechnologyItem | undefined {
  return getAllTechnologies().find((item) => item.slug === slug);
}

export function getImportedCandidateById(
  id: string
): ImportedCandidate | undefined {
  return getImportedCandidateFromWorkflow(id);
}

export {
  getTechnologyDraftById,
  getTechnologyDrafts,
  getTechnologyWorkspaceRecordById,
  getTechnologyWorkspaceRecords
};

export function getSkillBySlug(slug: string): SkillItem | undefined {
  return getAllSkills().find((item) => item.slug === slug);
}

export function getKnowledgeBySlug(slug: string): KnowledgeItem | undefined {
  return getAllKnowledge().find((item) => item.slug === slug);
}

export function getTagById(id: string): TopicTag | undefined {
  return topicTags.find((tag) => tag.id === id);
}

export function getTagsByIds(ids: string[]): TopicTag[] {
  return ids.map(getTagById).filter((tag): tag is TopicTag => Boolean(tag));
}

export function toUserFacingTechnologyItem(
  item: TechnologyWorkspaceRecord
): TechnologyItem {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    content: item.content,
    type: item.type,
    publishDate: item.publishDate,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    sourceLanguage: item.sourceLanguage,
    translationStatus: item.translationStatus,
    publisherName: item.publisherName,
    publisherType: item.publisherType,
    importanceLevel: item.importanceLevel,
    status: item.status,
    tags: [...item.tags],
    relatedKnowledgeIds: [...item.relatedKnowledgeIds],
    relatedSkillIds: [...item.relatedSkillIds],
    relatedTechnologyIds: [...(item.relatedTechnologyIds ?? [])],
    sourceReferences: (item.sourceReferences ?? []).map((reference) => ({
      sourceName: reference.sourceName,
      sourceUrl: reference.sourceUrl,
      publisherName: reference.publisherName,
      publishDate: reference.publishDate
    })),
    whyItMatters: item.whyItMatters,
    whoShouldCare: [...(item.whoShouldCare ?? [])],
    technicalContext: item.technicalContext,
    impactAreas: [...(item.impactAreas ?? [])],
    learningPath: [...(item.learningPath ?? [])],
    relatedKnowledgeExplanations: {
      ...(item.relatedKnowledgeExplanations ?? {})
    },
    relatedSkillExplanations: {
      ...(item.relatedSkillExplanations ?? {})
    },
    followUpQuestions: [...(item.followUpQuestions ?? [])],
    readingDifficulty: item.readingDifficulty
  };
}

// Public technology items intentionally carry neither the `priority` object
// nor `intelligenceStatus`. The full ranking (score, raw reasons, warnings) is
// internal-only per docs/security-boundary.md, and every public surface derives
// the productized priority level on demand via evaluateTechnologyPriority.
// `intelligenceStatus` is an editorial workflow state (draft / reviewed /
// needs_enrichment) that no public surface reads — shipping it told readers
// which records the editors consider unfinished. Stripping both here keeps them
// out of the RSC payloads of client components.
function withoutTechnologyPriorityInternals(
  item: TechnologyItem
): TechnologyItem {
  const {
    priority: _priority,
    intelligenceStatus: _intelligenceStatus,
    ...publicItem
  } = item;

  return publicItem;
}

function resolveTitle(kind: ContentKind, id: string): string | undefined {
  if (kind === "technology") {
    const technology = getAllTechnologies().find((item) => item.id === id);

    return technology ? getPreferredTechnologyTitle(technology) : undefined;
  }

  if (kind === "skill") {
    return getAllSkills().find((item) => item.id === id)?.title;
  }

  return getAllKnowledge().find((item) => item.id === id)?.title;
}

function resolveSlug(kind: ContentKind, id: string): string | undefined {
  if (kind === "technology") {
    return getAllTechnologies().find((item) => item.id === id)?.slug;
  }

  if (kind === "skill") {
    return getAllSkills().find((item) => item.id === id)?.slug;
  }

  return getAllKnowledge().find((item) => item.id === id)?.slug;
}

type TargetLookup = Map<string, { title: string; slug: string }>;

/**
 * Title and slug by id for one pool, so a per-item loop resolves each target
 * with a map lookup instead of `resolveTitle`/`resolveSlug`, which rebuild
 * (and for technologies re-sort) the whole pool on every call. Measured
 * 2026-10-14: `getContentGraph` spent 46ms of its time there, and the sitemap
 * ran it once per topic.
 */
function indexTargets<TItem extends { id: string; slug: string }>(
  items: TItem[],
  getTitle: (item: TItem) => string
): TargetLookup {
  const lookup: TargetLookup = new Map();

  for (const item of items) {
    // First entry wins, matching the `.find()` it replaces.
    if (!lookup.has(item.id)) {
      lookup.set(item.id, { title: getTitle(item), slug: item.slug });
    }
  }

  return lookup;
}

function loadTargetLookup(kind: ContentKind): TargetLookup {
  if (kind === "technology") {
    return indexTargets(getAllTechnologies(), getPreferredTechnologyTitle);
  }

  if (kind === "skill") {
    return indexTargets(getAllSkills(), (item) => item.title);
  }

  return indexTargets(getAllKnowledge(), (item) => item.title);
}

interface BuildRelationItemsOptions {
  fromId?: string;
  fromType?: ContentKind;
  targetType: ContentKind;
  targetIds: string[];
  defaultRelationType?: RelationType;
  defaultNote?: string;
  /**
   * The merged relation list to look pairs up in. Read once per call when
   * absent; a page building several lists can pass one read to all of them.
   */
  relations?: LinkRelation[];
}

export function buildRelationItems({
  fromId,
  fromType,
  targetType,
  targetIds,
  defaultRelationType = "related-to",
  defaultNote = "Linked in the content relationship model.",
  relations
}: BuildRelationItemsOptions): RelationListItem[] {
  if (targetIds.length === 0) {
    return [];
  }

  // Read once for the whole list: this used to call `getAllLinkRelations()`
  // (a parse of the 442 KB override store) and two pool rebuilds per target,
  // about 100ms on a signal page with 27 related items.
  const targets = loadTargetLookup(targetType);
  const relationList =
    fromId && fromType ? (relations ?? getAllLinkRelations()) : undefined;

  return targetIds
    .map((targetId): RelationListItem | undefined => {
      const target = targets.get(targetId);
      const title = target?.title;
      const slug = target?.slug;

      if (!title || !slug) {
        return undefined;
      }

      const relation =
        relationList && fromId && fromType
          ? findRelationIn(
              relationList,
              fromId,
              fromType,
              targetId,
              targetType,
              defaultRelationType
            )
          : undefined;

      return {
        id: `${fromId ?? "direct"}-${targetId}`,
        targetId,
        title,
        href: `${contentPathMap[targetType]}/${slug}`,
        relationType: relation?.relationType ?? defaultRelationType,
        note: relation?.note ?? defaultNote
      };
    })
    .filter((item): item is RelationListItem => Boolean(item));
}

export function getRelationItemsFor(
  fromId: string,
  fromType: ContentKind,
  targetType: ContentKind
): RelationListItem[] {
  return getAllLinkRelations()
    .filter(
      (relation) =>
        relation.fromId === fromId &&
        relation.fromType === fromType &&
        relation.toType === targetType
    )
    .map((relation) => {
      const title = resolveTitle(relation.toType, relation.toId);
      const slug = resolveSlug(relation.toType, relation.toId);

      if (!title || !slug) {
        return undefined;
      }

      return {
        id: relation.id,
        title,
        href: `${contentPathMap[relation.toType]}/${slug}`,
        relationType: relation.relationType,
        note: relation.note
      };
    })
    .filter((item): item is RelationListItem => Boolean(item));
}

/**
 * Looks up the semantic relation between two content items regardless of
 * which side the relation records as `from`/`to`, reading the merged view of
 * seed relations plus workspace overrides. Falls back to a generic relation
 * when no entry exists for the pair.
 */
export function findRelationBetween(
  aId: string,
  aType: ContentKind,
  bId: string,
  bType: ContentKind,
  defaultRelationType: RelationType = "related-to"
): { relationType: RelationType; note?: string } {
  return findRelationIn(
    getAllLinkRelations(),
    aId,
    aType,
    bId,
    bType,
    defaultRelationType
  );
}

export interface ContentGraphNode {
  id: string;
  title: string;
  href: string;
  kind: ContentKind;
}

export interface ContentGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  note?: string;
}

export interface ContentGraphData {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
}

/**
 * Builds the full technology/skill/knowledge graph (all nodes, all
 * relatedXIds pairs deduped as undirected edges) for the whole-network
 * overview page, resolving each edge's semantic type via
 * `findRelationBetween`.
 */
export function getContentGraph(): ContentGraphData {
  const technologies = getAllTechnologies();
  const skills = getAllSkills();
  const knowledge = getAllKnowledge();
  const lookups: Record<ContentKind, TargetLookup> = {
    technology: indexTargets(technologies, getPreferredTechnologyTitle),
    skill: indexTargets(skills, (item) => item.title),
    knowledge: indexTargets(knowledge, (item) => item.title)
  };

  const buildNode = (
    kind: ContentKind,
    id: string
  ): ContentGraphNode | undefined => {
    const target = lookups[kind].get(id);
    const title = target?.title;
    const slug = target?.slug;

    if (!title || !slug) {
      return undefined;
    }

    return { id, title, href: `${contentPathMap[kind]}/${slug}`, kind };
  };

  const nodes = [
    ...technologies.map((item) => buildNode("technology", item.id)),
    ...skills.map((item) => buildNode("skill", item.id)),
    ...knowledge.map((item) => buildNode("knowledge", item.id))
  ].filter((node): node is ContentGraphNode => Boolean(node));

  const kindById = new Map(nodes.map((node) => [node.id, node.kind]));
  const allRelations = getAllLinkRelations();
  const seenPairs = new Set<string>();
  const edges: ContentGraphEdge[] = [];

  const collectEdges = (fromId: string, targetIds: string[]) => {
    for (const targetId of targetIds) {
      if (targetId === fromId || !kindById.has(targetId)) {
        continue;
      }

      const pairKey = [fromId, targetId].sort().join("|");

      if (seenPairs.has(pairKey)) {
        continue;
      }

      seenPairs.add(pairKey);

      const fromType = kindById.get(fromId);
      const toType = kindById.get(targetId);

      if (!fromType || !toType) {
        continue;
      }

      const relation = findRelationIn(
        allRelations,
        fromId,
        fromType,
        targetId,
        toType
      );

      edges.push({
        id: pairKey,
        sourceId: fromId,
        targetId,
        relationType: relation.relationType,
        note: relation.note
      });
    }
  };

  technologies.forEach((item) => {
    collectEdges(item.id, item.relatedTechnologyIds ?? []);
    collectEdges(item.id, item.relatedSkillIds);
    collectEdges(item.id, item.relatedKnowledgeIds);
  });
  skills.forEach((item) => {
    collectEdges(item.id, item.relatedTechnologyIds);
    collectEdges(item.id, item.relatedKnowledgeIds);
  });
  knowledge.forEach((item) => {
    collectEdges(item.id, item.relatedTechnologyIds);
    collectEdges(item.id, item.relatedSkillIds);
  });

  return { nodes, edges };
}
