import { getActivePromptVersion } from "@/lib/prompt-versions";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type {
  TechnologyExplanationAudienceLevel,
  TechnologyItem
} from "@/types/content";

const audienceLevelDescriptions: Record<
  TechnologyExplanationAudienceLevel,
  string
> = {
  beginner:
    "beginner — new to AI engineering; avoid jargon, explain terms, lean on an everyday analogy",
  intermediate:
    "intermediate — a working developer who knows common AI concepts but not this technology",
  advanced:
    "advanced — an experienced engineer who wants the sharp technical essence and trade-offs"
};

function serializeTechnologyForPrompt(technology: TechnologyItem): string {
  return JSON.stringify(
    {
      title: getPreferredTechnologyTitle(technology),
      summary: getPreferredTechnologySummary(technology),
      type: technology.type,
      technicalContext: technology.technicalContext ?? "",
      whyItMatters: technology.whyItMatters ?? "",
      whoShouldCare: technology.whoShouldCare ?? [],
      impactAreas: technology.impactAreas ?? [],
      tags: technology.tags
    },
    null,
    2
  );
}

export function buildTechnologyExplanationPrompt(input: {
  technology: TechnologyItem;
  audienceLevel: TechnologyExplanationAudienceLevel;
}): {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  promptVersionId: string;
} {
  const { technology, audienceLevel } = input;
  const promptVersion = getActivePromptVersion("technology_explanation");

  return {
    promptVersion: promptVersion.version,
    promptVersionId: promptVersion.id,
    systemPrompt: promptVersion.template,
    userPrompt: [
      "Purpose: technology_explanation",
      `Prompt version: ${promptVersion.version}`,
      `Prompt version id: ${promptVersion.id}`,
      `Reader level: ${audienceLevelDescriptions[audienceLevel]}`,
      `Technology: ${serializeTechnologyForPrompt(technology)}`,
      "",
      "Respond in Simplified Chinese.",
      "Return a JSON object with exactly these public explanation fields:",
      JSON.stringify(promptVersion.outputSchema, null, 2),
      "",
      "Do not include provider metadata, prompt text, rawPayload, importStatus, normalizedType, duplicateGroupId, quality flags, delivery logs, audit logs, or any internal-only field."
    ].join("\n")
  };
}
