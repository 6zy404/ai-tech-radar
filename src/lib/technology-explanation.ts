import { randomUUID } from "node:crypto";

import { getAllTechnologies } from "@/lib/content";
import { getLlmProviderConfig } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { buildTechnologyExplanationPrompt } from "@/lib/llm/prompts/technology-explanation";
import { validateTechnologyExplanationLlmOutput } from "@/lib/llm/technology-explanation-output";
import { ensureDefaultPromptVersion } from "@/lib/prompt-versions";
import {
  getExplanationCacheKey,
  getTechnologyExplanationByCacheKey,
  saveTechnologyExplanationRecord
} from "@/lib/technology-explanation-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  TechnologyExplanationAudienceLevel,
  TechnologyExplanationPublicResult,
  TechnologyExplanationRecord
} from "@/types/content";

const explanationDisclaimer = "AI 生成内容，未经编辑审核，仅供参考。";

const audienceLevels: TechnologyExplanationAudienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced"
];

export type TechnologyExplanationError =
  | { code: "invalid_level"; message: string }
  | { code: "not_found"; message: string }
  | { code: "generation_failed"; message: string };

export function isTechnologyExplanationAudienceLevel(
  value: unknown
): value is TechnologyExplanationAudienceLevel {
  return audienceLevels.includes(value as TechnologyExplanationAudienceLevel);
}

export function toPublicExplanationResult(
  record: TechnologyExplanationRecord
): TechnologyExplanationPublicResult {
  return {
    technologyId: record.technologyId,
    audienceLevel: record.audienceLevel,
    fields: record.fields,
    disclaimer: explanationDisclaimer,
    generatedAt: record.updatedAt
  };
}

export async function generateOrGetTechnologyExplanation(
  technologyId: string,
  audienceLevel: TechnologyExplanationAudienceLevel
): Promise<
  | { result: TechnologyExplanationPublicResult }
  | { error: TechnologyExplanationError }
> {
  if (!isTechnologyExplanationAudienceLevel(audienceLevel)) {
    return {
      error: {
        code: "invalid_level",
        message: "请选择一个支持的阅读水平。"
      }
    };
  }

  const technology = getAllTechnologies().find(
    (item) => item.id === technologyId
  );

  if (!technology) {
    return {
      error: {
        code: "not_found",
        message: "找不到这条技术信号。"
      }
    };
  }

  const cacheKey = getExplanationCacheKey(technologyId, audienceLevel);
  const cached = getTechnologyExplanationByCacheKey(cacheKey);

  if (cached && cached.outputValidationStatus !== "failed") {
    return { result: toPublicExplanationResult(cached) };
  }

  ensureDefaultPromptVersion("technology_explanation");

  const config = getLlmProviderConfig();
  const generationMode =
    config.provider === "openai_compatible" ? "llm_assisted" : "mock_llm";
  const { systemPrompt, userPrompt, promptVersion, promptVersionId } =
    buildTechnologyExplanationPrompt({
      technology,
      audienceLevel
    });

  try {
    const provider = createConfiguredLlmProvider();
    const response = await provider.generate({ systemPrompt, userPrompt });
    const validation = validateTechnologyExplanationLlmOutput(response.text);

    const record: TechnologyExplanationRecord = {
      id: cached?.id ?? `technology-explanation-${randomUUID()}`,
      cacheKey,
      technologyId,
      audienceLevel,
      fields: validation.ok
        ? (validation.fields as TechnologyExplanationRecord["fields"])
        : {
            explanation: "",
            keyPoints: []
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

    const savedRecord = saveTechnologyExplanationRecord(record);

    tryRecordWorkflowEvent({
      entityType: "technology_explanation",
      entityId: cacheKey,
      action: "technology_explanation.generated",
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
          message: "解读功能暂时不可用，请稍后再试。"
        }
      };
    }

    return { result: toPublicExplanationResult(savedRecord) };
  } catch (error) {
    tryRecordWorkflowEvent({
      entityType: "technology_explanation",
      entityId: cacheKey,
      action: "technology_explanation.generation_failed",
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
        message: "解读功能暂时不可用，请稍后再试。"
      }
    };
  }
}
