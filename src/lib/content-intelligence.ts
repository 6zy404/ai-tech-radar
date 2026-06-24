import type {
  ReadingDifficulty,
  TechnologyItem,
  TechnologyPriorityRanking
} from "@/types/content";

export interface DigestTechnologyIntelligenceSummary {
  whyItMatters?: string;
  audience: string[];
  relatedSkillCount: number;
  relatedKnowledgeCount: number;
  priorityReason: string;
}

const readingDifficultyLabels: Record<ReadingDifficulty, string> = {
  beginner: "入门友好",
  intermediate: "进阶",
  advanced: "高级"
};

export function getReadingDifficultyLabel(
  difficulty: ReadingDifficulty | undefined
): string | undefined {
  return difficulty ? readingDifficultyLabels[difficulty] : undefined;
}

export function getTechnologyWhyItMatters(
  technology: TechnologyItem,
  fallback?: string
): string | undefined {
  return technology.whyItMatters?.trim() || fallback?.trim() || undefined;
}

export function getTechnologyAudience(technology: TechnologyItem): string[] {
  return (technology.whoShouldCare ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getTechnologyImpactAreas(technology: TechnologyItem): string[] {
  return (technology.impactAreas ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getTechnologyLearningPath(technology: TechnologyItem): string[] {
  return (technology.learningPath ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getTechnologyFollowUpQuestions(
  technology: TechnologyItem
): string[] {
  return (technology.followUpQuestions ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getTechnologyKnowledgeExplanation(
  technology: TechnologyItem,
  knowledgeId: string,
  fallback?: string
): string {
  return (
    technology.relatedKnowledgeExplanations?.[knowledgeId]?.trim() ||
    fallback?.trim() ||
    "This background helps explain the technology signal."
  );
}

export function getTechnologySkillExplanation(
  technology: TechnologyItem,
  skillId: string,
  fallback?: string
): string {
  return (
    technology.relatedSkillExplanations?.[skillId]?.trim() ||
    fallback?.trim() ||
    "This skill helps evaluate or apply the technology signal."
  );
}

export function getDigestTechnologyIntelligenceSummary(
  technology: TechnologyItem,
  ranking: TechnologyPriorityRanking,
  prioritySummary: string
): DigestTechnologyIntelligenceSummary {
  return {
    whyItMatters: getTechnologyWhyItMatters(technology),
    audience: getTechnologyAudience(technology).slice(0, 3),
    relatedSkillCount: technology.relatedSkillIds.length,
    relatedKnowledgeCount: technology.relatedKnowledgeIds.length,
    priorityReason: ranking.priorityReasons[0] ?? prioritySummary
  };
}
