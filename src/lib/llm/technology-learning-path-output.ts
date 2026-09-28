import {
  parseLlmJsonObject,
  sanitizeString,
  sanitizeStringArray
} from "@/lib/llm/output-sanitization";
import type { TechnologyLearningPathFields } from "@/types/content";

const allowedTopLevelFields = new Set(["overview", "steps", "checkpoints"]);

export interface ValidatedTechnologyLearningPathOutput {
  ok: boolean;
  fields: TechnologyLearningPathFields | Record<string, never>;
  warnings: string[];
  error?: string;
}

export function validateTechnologyLearningPathLlmOutput(
  rawText: string
): ValidatedTechnologyLearningPathOutput {
  const parsed = parseLlmJsonObject(rawText, allowedTopLevelFields);

  if (!parsed.ok) {
    return { ok: false, fields: {}, warnings: [], error: parsed.error };
  }

  const { record: parsedRecord, warnings } = parsed;

  const overview = sanitizeString(parsedRecord.overview, 600);
  const steps = sanitizeStringArray(parsedRecord.steps, 6, 260);
  const checkpoints = sanitizeStringArray(parsedRecord.checkpoints, 4, 220);

  if (!overview) {
    return {
      ok: false,
      fields: {},
      warnings,
      error:
        "LLM output is missing overview, which is required for a learning path."
    };
  }

  if (!steps || steps.length === 0) {
    return {
      ok: false,
      fields: {},
      warnings,
      error:
        "LLM output is missing steps, which are required for a learning path."
    };
  }

  const fields: TechnologyLearningPathFields = {
    overview,
    steps
  };

  if (checkpoints) {
    fields.checkpoints = checkpoints;
  }

  return {
    ok: true,
    fields,
    warnings,
    error: undefined
  };
}
