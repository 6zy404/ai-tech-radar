import { randomUUID } from "node:crypto";

import { findRelationBetween, getAllTechnologies } from "@/lib/content";
import { getLlmProviderConfig } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { buildTechnologyComparisonPrompt } from "@/lib/llm/prompts/technology-comparison";
import { validateTechnologyComparisonLlmOutput } from "@/lib/llm/technology-comparison-output";
import { ensureDefaultPromptVersion } from "@/lib/prompt-versions";
import {
  getComparisonPairKey,
  getTechnologyComparisonByPairKey,
  saveTechnologyComparisonRecord
} from "@/lib/technology-comparison-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  TechnologyComparisonPublicResult,
  TechnologyComparisonRecord,
  TechnologyItem
} from "@/types/content";

const comparisonDisclaimer = "AI 生成内容，未经编辑审核，仅供参考。";

export type TechnologyComparisonError =
  | { code: "invalid_pair"; message: string }
  | { code: "not_found"; message: string }
  | { code: "generation_failed"; message: string };

export function getComparableTechnologies(excludeId: string): TechnologyItem[] {
  return getAllTechnologies().filter((item) => item.id !== excludeId);
}

export function toPublicComparisonResult(
  record: TechnologyComparisonRecord
): TechnologyComparisonPublicResult {
  return {
    technologyIdA: record.technologyIdA,
    technologyIdB: record.technologyIdB,
    fields: record.fields,
    disclaimer: comparisonDisclaimer,
    generatedAt: record.updatedAt
  };
}

export async function generateOrGetTechnologyComparison(
  technologyIdA: string,
  technologyIdB: string
): Promise<
  { result: TechnologyComparisonPublicResult } | { error: TechnologyComparisonError }
> {
  if (technologyIdA === technologyIdB) {
    return {
      error: {
        code: "invalid_pair",
        message: "Choose two different technologies to compare."
      }
    };
  }

  const technologies = getAllTechnologies();
  const technologyA = technologies.find((item) => item.id === technologyIdA);
  const technologyB = technologies.find((item) => item.id === technologyIdB);

  if (!technologyA || !technologyB) {
    return {
      error: {
        code: "not_found",
        message: "One or both technologies could not be found."
      }
    };
  }

  const pairKey = getComparisonPairKey(technologyIdA, technologyIdB);
  const cached = getTechnologyComparisonByPairKey(pairKey);

  if (cached && cached.outputValidationStatus !== "failed") {
    return { result: toPublicComparisonResult(cached) };
  }

  ensureDefaultPromptVersion("technology_comparison");

  const relation = findRelationBetween(
    technologyIdA,
    "technology",
    technologyIdB,
    "technology"
  );
  const config = getLlmProviderConfig();
  const generationMode = config.provider === "openai_compatible" ? "llm_assisted" : "mock_llm";
  const { systemPrompt, userPrompt, promptVersion, promptVersionId } =
    buildTechnologyComparisonPrompt({
      technologyA,
      technologyB,
      relation
    });

  const [sortedIdA, sortedIdB] = [technologyIdA, technologyIdB].sort();

  try {
    const provider = createConfiguredLlmProvider();
    const response = await provider.generate({ systemPrompt, userPrompt });
    const validation = validateTechnologyComparisonLlmOutput(response.text);

    const record: TechnologyComparisonRecord = {
      id: cached?.id ?? `technology-comparison-${randomUUID()}`,
      pairKey,
      technologyIdA: sortedIdA,
      technologyIdB: sortedIdB,
      fields: validation.ok
        ? (validation.fields as TechnologyComparisonRecord["fields"])
        : { similarities: [], differences: [], whenToPreferA: "", whenToPreferB: "" },
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

    const savedRecord = saveTechnologyComparisonRecord(record);

    tryRecordWorkflowEvent({
      entityType: "technology_comparison",
      entityId: pairKey,
      action: "technology_comparison.generated",
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
          message: "Comparison generation is temporarily unavailable."
        }
      };
    }

    return { result: toPublicComparisonResult(savedRecord) };
  } catch (error) {
    tryRecordWorkflowEvent({
      entityType: "technology_comparison",
      entityId: pairKey,
      action: "technology_comparison.generation_failed",
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
        message: "Comparison generation is temporarily unavailable."
      }
    };
  }
}
