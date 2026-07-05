import { getActivePromptVersion } from "@/lib/prompt-versions";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type { KnowledgeItem, SkillItem, TechnologyItem } from "@/types/content";

function serializeTechnologyForPrompt(technology: TechnologyItem): string {
  return JSON.stringify(
    {
      title: getPreferredTechnologyTitle(technology),
      summary: getPreferredTechnologySummary(technology),
      type: technology.type,
      technicalContext: technology.technicalContext ?? "",
      whyItMatters: technology.whyItMatters ?? "",
      readingDifficulty: technology.readingDifficulty ?? "",
      tags: technology.tags
    },
    null,
    2
  );
}

function serializeRelatedItemsForPrompt(
  items: { title: string; summary: string }[]
): string {
  return JSON.stringify(
    items.map((item) => ({ title: item.title, summary: item.summary })),
    null,
    2
  );
}

export function buildTechnologyLearningPathPrompt(input: {
  technology: TechnologyItem;
  relatedKnowledge: KnowledgeItem[];
  relatedSkills: SkillItem[];
}): {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  promptVersionId: string;
} {
  const { technology, relatedKnowledge, relatedSkills } = input;
  const promptVersion = getActivePromptVersion("technology_learning_path");

  return {
    promptVersion: promptVersion.version,
    promptVersionId: promptVersion.id,
    systemPrompt: promptVersion.template,
    userPrompt: [
      "Purpose: technology_learning_path",
      `Prompt version: ${promptVersion.version}`,
      `Prompt version id: ${promptVersion.id}`,
      `Technology: ${serializeTechnologyForPrompt(technology)}`,
      `Related background knowledge (from the content graph): ${serializeRelatedItemsForPrompt(relatedKnowledge)}`,
      `Related skills (from the content graph): ${serializeRelatedItemsForPrompt(relatedSkills)}`,
      "",
      "Respond in Simplified Chinese.",
      "Build the learning steps on the related knowledge and skills above, referencing them by name where they fit.",
      "Return a JSON object with exactly these public learning path fields:",
      JSON.stringify(promptVersion.outputSchema, null, 2),
      "",
      "Do not include provider metadata, prompt text, rawPayload, importStatus, normalizedType, duplicateGroupId, quality flags, delivery logs, audit logs, or any internal-only field."
    ].join("\n")
  };
}
