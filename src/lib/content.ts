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
import {
  homeFeaturedTechnologyIds,
  technologyItems
} from "@/data/technologies";
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

export function getAllTechnologies(): TechnologyItem[] {
  const seedTechnologies =
    getPersistenceDriver() === "sqlite"
      ? readSqliteSeedTechnologies()
      : technologyItems;

  return [
    ...seedTechnologies
      .filter((item) => item.status === "published")
      .map(withoutTechnologyPriorityInternals),
    ...getPublishedTechnologyWorkspaceRecords().map(toUserFacingTechnologyItem)
  ].sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}

export function getAllImportedCandidates(): ImportedCandidate[] {
  return getImportedCandidatesFromWorkflow();
}

export function getAllSkills(): SkillItem[] {
  const baseSkills =
    getPersistenceDriver() === "sqlite" ? readSqliteSkillItems() : skillItems;

  return getMergedPublicSkills(baseSkills);
}

export function getAllKnowledge(): KnowledgeItem[] {
  const baseKnowledge =
    getPersistenceDriver() === "sqlite"
      ? readSqliteKnowledgeItems()
      : knowledgeItems;

  return getMergedPublicKnowledge(baseKnowledge);
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

export function getFeaturedTechnologies(): TechnologyItem[] {
  return homeFeaturedTechnologyIds
    .map((id) => getAllTechnologies().find((item) => item.id === id))
    .filter((item): item is TechnologyItem => Boolean(item));
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
    readingDifficulty: item.readingDifficulty,
    intelligenceStatus: item.intelligenceStatus
  };
}

// Public technology items intentionally carry no `priority` object: the full
// ranking (score, raw reasons, warnings) is internal-only per
// docs/security-boundary.md, and every public surface derives the productized
// priority level on demand via evaluateTechnologyPriority. Stripping it here
// keeps ranking internals out of RSC payloads for client components.
function withoutTechnologyPriorityInternals(
  item: TechnologyItem
): TechnologyItem {
  const { priority: _priority, ...publicItem } = item;

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

interface BuildRelationItemsOptions {
  fromId?: string;
  fromType?: ContentKind;
  targetType: ContentKind;
  targetIds: string[];
  defaultRelationType?: RelationType;
  defaultNote?: string;
}

export function buildRelationItems({
  fromId,
  fromType,
  targetType,
  targetIds,
  defaultRelationType = "related-to",
  defaultNote = "Linked in the content relationship model."
}: BuildRelationItemsOptions): RelationListItem[] {
  return targetIds
    .map((targetId) => {
      const title = resolveTitle(targetType, targetId);
      const slug = resolveSlug(targetType, targetId);

      if (!title || !slug) {
        return undefined;
      }

      const relation =
        fromId && fromType
          ? findRelationIn(
              getAllLinkRelations(),
              fromId,
              fromType,
              targetId,
              targetType,
              defaultRelationType
            )
          : undefined;

      return {
        id: `${fromId ?? "direct"}-${targetId}`,
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

  const buildNode = (
    kind: ContentKind,
    id: string
  ): ContentGraphNode | undefined => {
    const title = resolveTitle(kind, id);
    const slug = resolveSlug(kind, id);

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
