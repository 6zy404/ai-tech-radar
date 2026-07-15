import type { SkillWorkspaceUpdate } from "@/lib/skill-workflow";
import type { HeatLevel, LearningCost, SkillType } from "@/types/content";

const skillTypes: SkillType[] = [
  "engineering",
  "analysis",
  "product",
  "operations",
  "communication"
];
const heatLevels: HeatLevel[] = ["emerging", "active", "hot"];
const learningCosts: LearningCost[] = ["low", "medium", "high"];

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

export function parseSkillWorkspaceUpdate(
  body: Record<string, unknown>
): SkillWorkspaceUpdate {
  return {
    title: getString(body.title),
    slug: getString(body.slug),
    summary: getString(body.summary),
    content: getString(body.content),
    skillType: getEnumValue(body.skillType, skillTypes),
    heatLevel: getEnumValue(body.heatLevel, heatLevels),
    learningCost: getEnumValue(body.learningCost, learningCosts),
    tags: getStringArray(body.tags),
    relatedTechnologyIds: getStringArray(body.relatedTechnologyIds),
    relatedKnowledgeIds: getStringArray(body.relatedKnowledgeIds)
  };
}
