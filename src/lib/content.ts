import { knowledgeItems } from "@/data/knowledge";
import { linkRelations } from "@/data/relations";
import { skillItems } from "@/data/skills";
import { topicTags } from "@/data/tags";
import {
  getImportedCandidateById as getImportedCandidateFromWorkflow,
  getImportedCandidates as getImportedCandidatesFromWorkflow,
  getPublishedTechnologyWorkspaceRecords,
  getTechnologyDraftById,
  getTechnologyDrafts,
  getTechnologyWorkspaceRecordById,
  getTechnologyWorkspaceRecords
} from "@/lib/candidate-workflow";
import { homeFeaturedTechnologyIds, technologyItems } from "@/data/technologies";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPersistenceDriver,
  readSqliteKnowledgeItems,
  readSqliteSeedTechnologies,
  readSqliteSkillItems
} from "@/lib/repositories/sqlite-store";
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
      .map(withTechnologyPriority),
    ...getPublishedTechnologyWorkspaceRecords().map(toUserFacingTechnologyItem)
  ].sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}

export function getAllImportedCandidates(): ImportedCandidate[] {
  return getImportedCandidatesFromWorkflow();
}

export function getAllSkills(): SkillItem[] {
  return getPersistenceDriver() === "sqlite" ? readSqliteSkillItems() : skillItems;
}

export function getAllKnowledge(): KnowledgeItem[] {
  return getPersistenceDriver() === "sqlite"
    ? readSqliteKnowledgeItems()
    : knowledgeItems;
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
  return skillItems.find((item) => item.slug === slug);
}

export function getKnowledgeBySlug(slug: string): KnowledgeItem | undefined {
  return knowledgeItems.find((item) => item.slug === slug);
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
  return withTechnologyPriority({
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
  });
}

function withTechnologyPriority(item: TechnologyItem): TechnologyItem {
  return {
    ...item,
    priority: evaluateTechnologyPriority(item)
  };
}

function resolveTitle(kind: ContentKind, id: string): string | undefined {
  if (kind === "technology") {
    const technology = getAllTechnologies().find((item) => item.id === id);

    return technology ? getPreferredTechnologyTitle(technology) : undefined;
  }

  if (kind === "skill") {
    return skillItems.find((item) => item.id === id)?.title;
  }

  return knowledgeItems.find((item) => item.id === id)?.title;
}

function resolveSlug(kind: ContentKind, id: string): string | undefined {
  if (kind === "technology") {
    return getAllTechnologies().find((item) => item.id === id)?.slug;
  }

  if (kind === "skill") {
    return skillItems.find((item) => item.id === id)?.slug;
  }

  return knowledgeItems.find((item) => item.id === id)?.slug;
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

      const relation = fromId && fromType
        ? linkRelations.find(
            (item) =>
              item.fromId === fromId &&
              item.fromType === fromType &&
              item.toId === targetId &&
              item.toType === targetType
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
  return linkRelations
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
