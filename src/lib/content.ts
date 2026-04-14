import { knowledgeItems } from "@/data/knowledge";
import { linkRelations } from "@/data/relations";
import { skillItems } from "@/data/skills";
import { topicTags } from "@/data/tags";
import { homeFeaturedTechnologyIds, technologyItems } from "@/data/technologies";
import type {
  ContentKind,
  KnowledgeItem,
  RelationListItem,
  RelationType,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

const contentPathMap: Record<ContentKind, string> = {
  technology: "/technologies",
  skill: "/skills",
  knowledge: "/knowledge"
};

export function getAllTechnologies(): TechnologyItem[] {
  return technologyItems;
}

export function getAllSkills(): SkillItem[] {
  return skillItems;
}

export function getAllKnowledge(): KnowledgeItem[] {
  return knowledgeItems;
}

export function getAllTags(): TopicTag[] {
  return topicTags;
}

export function getTechnologyBySlug(slug: string): TechnologyItem | undefined {
  return technologyItems.find((item) => item.slug === slug);
}

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
    .map((id) => technologyItems.find((item) => item.id === id))
    .filter((item): item is TechnologyItem => Boolean(item));
}

function resolveTitle(kind: ContentKind, id: string): string | undefined {
  if (kind === "technology") {
    return technologyItems.find((item) => item.id === id)?.title;
  }

  if (kind === "skill") {
    return skillItems.find((item) => item.id === id)?.title;
  }

  return knowledgeItems.find((item) => item.id === id)?.title;
}

function resolveSlug(kind: ContentKind, id: string): string | undefined {
  if (kind === "technology") {
    return technologyItems.find((item) => item.id === id)?.slug;
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
  defaultNote = "Linked in the mock data model."
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
