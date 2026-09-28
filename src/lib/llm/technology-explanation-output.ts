import {
  parseLlmJsonObject,
  sanitizeString,
  sanitizeStringArray
} from "@/lib/llm/output-sanitization";
import type { TechnologyExplanationFields } from "@/types/content";

const allowedTopLevelFields = new Set([
  "explanation",
  "keyPoints",
  "analogy",
  "nextSteps"
]);

export interface ValidatedTechnologyExplanationOutput {
  ok: boolean;
  fields: TechnologyExplanationFields | Record<string, never>;
  warnings: string[];
  error?: string;
}

export function validateTechnologyExplanationLlmOutput(
  rawText: string
): ValidatedTechnologyExplanationOutput {
  const parsed = parseLlmJsonObject(rawText, allowedTopLevelFields);

  if (!parsed.ok) {
    return { ok: false, fields: {}, warnings: [], error: parsed.error };
  }

  const { record: parsedRecord, warnings } = parsed;

  const explanation = sanitizeString(parsedRecord.explanation, 900);
  const keyPoints = sanitizeStringArray(parsedRecord.keyPoints, 5, 220);
  const analogy = sanitizeString(parsedRecord.analogy, 320);
  const nextSteps = sanitizeStringArray(parsedRecord.nextSteps, 4, 220);

  if (!explanation) {
    return {
      ok: false,
      fields: {},
      warnings,
      error:
        "LLM output is missing explanation, which is required for an explanation."
    };
  }

  const fields: TechnologyExplanationFields = {
    explanation,
    keyPoints: keyPoints ?? []
  };

  if (analogy) {
    fields.analogy = analogy;
  }

  if (nextSteps) {
    fields.nextSteps = nextSteps;
  }

  return {
    ok: true,
    fields,
    warnings,
    error: undefined
  };
}
