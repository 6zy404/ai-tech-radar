import { randomUUID } from "node:crypto";

import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "@/lib/content";
import { getLlmProviderConfig } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { buildTechnologyLearningPathPrompt } from "@/lib/llm/prompts/technology-learning-path";
import { validateTechnologyLearningPathLlmOutput } from "@/lib/llm/technology-learning-path-output";
import { ensureDefaultPromptVersion } from "@/lib/prompt-versions";
import {
  getTechnologyLearningPathByTechnologyId,
  saveTechnologyLearningPathRecord
} from "@/lib/technology-learning-path-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  TechnologyLearningPathPublicResult,
  TechnologyLearningPathRecord
} from "@/types/content";

const learningPathDisclaimer = "AI 生成内容，未经编辑审核，仅供参考。";

export type TechnologyLearningPathError =
  | { code: "not_found"; message: string }
  | { code: "generation_failed"; message: string };

export function toPublicLearningPathResult(
  record: TechnologyLearningPathRecord
): TechnologyLearningPathPublicResult {
  return {
    technologyId: record.technologyId,
    fields: record.fields,
    disclaimer: learningPathDisclaimer,
    generatedAt: record.updatedAt
  };
}

export async function generateOrGetTechnologyLearningPath(
  technologyId: string
): Promise<
  | { result: TechnologyLearningPathPublicResult }
  | { error: TechnologyLearningPathError }
> {
  const technology = getAllTechnologies().find(
    (item) => item.id === technologyId
  );

  if (!technology) {
    return {
      error: {
        code: "not_found",
        message: "The technology could not be found."
      }
    };
  }

  const cached = getTechnologyLearningPathByTechnologyId(technologyId);

  if (cached && cached.outputValidationStatus !== "failed") {
    return { result: toPublicLearningPathResult(cached) };
  }

  ensureDefaultPromptVersion("technology_learning_path");

  const relatedKnowledgeIds = new Set(technology.relatedKnowledgeIds);
  const relatedSkillIds = new Set(technology.relatedSkillIds);
  const relatedKnowledge = getAllKnowledge().filter((item) =>
    relatedKnowledgeIds.has(item.id)
  );
  const relatedSkills = getAllSkills().filter((item) =>
    relatedSkillIds.has(item.id)
  );

  const config = getLlmProviderConfig();
  const generationMode =
    config.provider === "openai_compatible" ? "llm_assisted" : "mock_llm";
  const { systemPrompt, userPrompt, promptVersion, promptVersionId } =
    buildTechnologyLearningPathPrompt({
      technology,
      relatedKnowledge,
      relatedSkills
    });

  try {
    const provider = createConfiguredLlmProvider();
    const response = await provider.generate({ systemPrompt, userPrompt });
    const validation = validateTechnologyLearningPathLlmOutput(response.text);

    const record: TechnologyLearningPathRecord = {
      id: cached?.id ?? `technology-learning-path-${randomUUID()}`,
      technologyId,
      fields: validation.ok
        ? (validation.fields as TechnologyLearningPathRecord["fields"])
        : {
            overview: "",
            steps: []
          },
      generationMode,
      providerName: response.providerName,
      modelName: response.modelName,
      promptVersionId,
      promptVersion,
      outputValidationStatus: validation.ok
        ? validation.warnings.length > 0
          ? "warning"
          : "valid"
        : "failed",
      outputValidationWarnings: validation.warnings,
      generationError: validation.ok ? undefined : validation.error,
      createdAt: cached?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedRecord = saveTechnologyLearningPathRecord(record);

    tryRecordWorkflowEvent({
      entityType: "technology_learning_path",
      entityId: technologyId,
      action: "technology_learning_path.generated",
      actorType: "system",
      metadata: {
        generationMode,
        providerName: response.providerName,
        modelName: response.modelName,
        promptVersionId,
        outputValidationStatus: savedRecord.outputValidationStatus
      }
    });

    if (savedRecord.outputValidationStatus === "failed") {
      return {
        error: {
          code: "generation_failed",
          message: "Learning path generation is temporarily unavailable."
        }
      };
    }

    return { result: toPublicLearningPathResult(savedRecord) };
  } catch (error) {
    tryRecordWorkflowEvent({
      entityType: "technology_learning_path",
      entityId: technologyId,
      action: "technology_learning_path.generation_failed",
      actorType: "system",
      metadata: {
        generationMode,
        promptVersionId,
        generationError:
          error instanceof Error ? error.message : "Unknown provider error."
      }
    });

    return {
      error: {
        code: "generation_failed",
        message: "Learning path generation is temporarily unavailable."
      }
    };
  }
}
