import type { KnowledgeWorkspaceUpdate } from "@/lib/knowledge-workflow";
import type { DifficultyLevel, KnowledgeCategory } from "@/types/content";

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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | undefined {
  return typeof value === "string" && allowedValues.includes(value as T)
    ? (value as T)
    : undefined;
}

export function parseKnowledgeWorkspaceUpdate(
  body: Record<string, unknown>
): KnowledgeWorkspaceUpdate {
  return {
    title: getString(body.title),
    slug: getString(body.slug),
    summary: getString(body.summary),
    content: getString(body.content),
    category: getEnumValue(body.category, knowledgeCategories),
    difficulty: getEnumValue(body.difficulty, difficultyLevels),
    tags: getStringArray(body.tags),
    relatedTechnologyIds: getStringArray(body.relatedTechnologyIds),
    relatedSkillIds: getStringArray(body.relatedSkillIds)
  };
}
