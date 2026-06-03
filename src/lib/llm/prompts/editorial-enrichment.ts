import type {
  EditorialEnrichmentSourceInputs,
  TechnologyWorkspaceRecord
} from "@/types/content";
import {
  defaultEditorialEnrichmentPromptVersion,
  getActivePromptVersion
} from "@/lib/prompt-versions";

export const editorialEnrichmentPromptVersion =
  defaultEditorialEnrichmentPromptVersion.version;

function serializeExistingContentIntelligence(
  record: TechnologyWorkspaceRecord
): string {
  return JSON.stringify(
    {
      whyItMatters: record.whyItMatters ?? "",
      whoShouldCare: record.whoShouldCare ?? [],
      technicalContext: record.technicalContext ?? "",
      impactAreas: record.impactAreas ?? [],
      learningPath: record.learningPath ?? [],
      relatedKnowledgeExplanations: record.relatedKnowledgeExplanations ?? {},
      relatedSkillExplanations: record.relatedSkillExplanations ?? {},
      followUpQuestions: record.followUpQuestions ?? [],
      readingDifficulty: record.readingDifficulty,
      intelligenceStatus: record.intelligenceStatus
    },
    null,
    2
  );
}

export function buildEditorialEnrichmentPrompt(input: {
  record: TechnologyWorkspaceRecord;
  sourceInputs: EditorialEnrichmentSourceInputs;
}): {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  promptVersionId: string;
} {
  const { record, sourceInputs } = input;
  const promptVersion = getActivePromptVersion("editorial_enrichment");

  return {
    promptVersion: promptVersion.version,
    promptVersionId: promptVersion.id,
    systemPrompt: promptVersion.template,
    userPrompt: [
      `Prompt version: ${promptVersion.version}`,
      `Prompt version id: ${promptVersion.id}`,
      `Title: ${sourceInputs.title.zh || sourceInputs.title.original}`,
      `Summary: ${sourceInputs.summary.zh || sourceInputs.summary.original}`,
      `Content excerpt: ${sourceInputs.contentPreview}`,
      `Source name: ${sourceInputs.sourceName}`,
      `Publisher name: ${sourceInputs.publisherName || record.publisherName || "Unknown"}`,
      `Tags: ${sourceInputs.tags.join(", ") || "None"}`,
      `Priority level: ${sourceInputs.priorityLevel || "unknown"}`,
      `Priority reasons: ${sourceInputs.priorityReasons.join(" | ") || "None"}`,
      `Source language: ${sourceInputs.sourceLanguage}`,
      `Related knowledge: ${JSON.stringify(sourceInputs.relatedKnowledge)}`,
      `Related skills: ${JSON.stringify(sourceInputs.relatedSkills)}`,
      `Existing content intelligence: ${serializeExistingContentIntelligence(record)}`,
      "",
      "Return a JSON object with exactly these public enrichment fields:",
      JSON.stringify(promptVersion.outputSchema, null, 2),
      "",
      "Do not include provider metadata, prompt text, rawPayload, importStatus, normalizedType, duplicateGroupId, quality flags, delivery logs, audit logs, or any internal-only field."
    ].join("\n")
  };
}
