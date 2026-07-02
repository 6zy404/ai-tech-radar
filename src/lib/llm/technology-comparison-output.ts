import {
  extractJsonText,
  hasInternalTerms,
  sanitizeString,
  sanitizeStringArray
} from "@/lib/llm/output-sanitization";
import type { TechnologyComparisonFields } from "@/types/content";

const allowedTopLevelFields = new Set([
  "similarities",
  "differences",
  "whenToPreferA",
  "whenToPreferB",
  "sharedConsiderations"
]);

export interface ValidatedTechnologyComparisonOutput {
  ok: boolean;
  fields: TechnologyComparisonFields | Record<string, never>;
  warnings: string[];
  error?: string;
}

export function validateTechnologyComparisonLlmOutput(
  rawText: string
): ValidatedTechnologyComparisonOutput {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJsonText(rawText));
  } catch {
    return {
      ok: false,
      fields: {},
      warnings: [],
      error: "LLM output was not valid JSON."
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      fields: {},
      warnings: [],
      error: "LLM output must be a JSON object."
    };
  }

  if (hasInternalTerms(parsed)) {
    return {
      ok: false,
      fields: {},
      warnings: [],
      error: "LLM output contained internal-only fields or terms."
    };
  }

  const parsedRecord = parsed as Record<string, unknown>;
  const extraFields = Object.keys(parsedRecord).filter(
    (key) => !allowedTopLevelFields.has(key)
  );
  const warnings = extraFields.map(
    (field) => `Ignored unsupported LLM output field: ${field}.`
  );

  const similarities = sanitizeStringArray(parsedRecord.similarities, 6, 220);
  const differences = sanitizeStringArray(parsedRecord.differences, 6, 220);
  const whenToPreferA = sanitizeString(parsedRecord.whenToPreferA, 420);
  const whenToPreferB = sanitizeString(parsedRecord.whenToPreferB, 420);
  const sharedConsiderations = sanitizeStringArray(
    parsedRecord.sharedConsiderations,
    6,
    220
  );

  if (!whenToPreferA || !whenToPreferB) {
    return {
      ok: false,
      fields: {},
      warnings,
      error:
        "LLM output is missing whenToPreferA or whenToPreferB, which are required for a comparison."
    };
  }

  const fields: TechnologyComparisonFields = {
    similarities: similarities ?? [],
    differences: differences ?? [],
    whenToPreferA,
    whenToPreferB
  };

  if (sharedConsiderations) {
    fields.sharedConsiderations = sharedConsiderations;
  }

  return {
    ok: true,
    fields,
    warnings,
    error: undefined
  };
}
