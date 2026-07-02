import { getActivePromptVersion } from "@/lib/prompt-versions";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle,
  getRelationTypeLabel
} from "@/lib/technology-localization";
import type { RelationType, TechnologyItem } from "@/types/content";

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

export function buildTechnologyComparisonPrompt(input: {
  technologyA: TechnologyItem;
  technologyB: TechnologyItem;
  relation: { relationType: RelationType; note?: string };
}): {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  promptVersionId: string;
} {
  const { technologyA, technologyB, relation } = input;
  const promptVersion = getActivePromptVersion("technology_comparison");
  const relationLine =
    relation.relationType !== "related-to"
      ? `Known relation between them: "${getRelationTypeLabel(relation.relationType, "zh")}"${relation.note ? ` — ${relation.note}` : ""}`
      : "Known relation between them: none explicitly recorded.";

  return {
    promptVersion: promptVersion.version,
    promptVersionId: promptVersion.id,
    systemPrompt: promptVersion.template,
    userPrompt: [
      "Purpose: technology_comparison",
      `Prompt version: ${promptVersion.version}`,
      `Prompt version id: ${promptVersion.id}`,
      `Technology A: ${serializeTechnologyForPrompt(technologyA)}`,
      `Technology B: ${serializeTechnologyForPrompt(technologyB)}`,
      relationLine,
      "",
      "Respond in Simplified Chinese.",
      "Return a JSON object with exactly these public comparison fields:",
      JSON.stringify(promptVersion.outputSchema, null, 2),
      "",
      "Do not include provider metadata, prompt text, rawPayload, importStatus, normalizedType, duplicateGroupId, quality flags, delivery logs, audit logs, or any internal-only field."
    ].join("\n")
  };
}
