import {
  extractJsonText,
  hasInternalTerms,
  sanitizeString,
  sanitizeStringArray
} from "@/lib/llm/output-sanitization";
import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentSourceInputs,
  ReadingDifficulty
} from "@/types/content";

const allowedTopLevelFields = new Set([
  "whyItMatters",
  "whoShouldCare",
  "technicalContext",
  "impactAreas",
  "learningPath",
  "relatedKnowledgeExplanations",
  "relatedSkillExplanations",
  "followUpQuestions",
  "readingDifficulty",
  "confidence",
  "limitations"
]);

export interface ValidatedEditorialEnrichmentOutput {
  ok: boolean;
  fields: EditorialEnrichmentGeneratedFields;
  confidence?: number;
  limitations: string[];
  warnings: string[];
  error?: string;
}

function sanitizeExplanationRecord(
  value: unknown,
  allowedIds: string[],
  maxLength: number
): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const allowedIdSet = new Set(allowedIds);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => allowedIdSet.has(key))
    .map(([key, item]) => [key, sanitizeString(item, maxLength)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function sanitizeReadingDifficulty(
  value: unknown
): ReadingDifficulty | undefined {
  return value === "beginner" ||
    value === "intermediate" ||
    value === "advanced"
    ? value
    : undefined;
}

function sanitizeConfidence(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return Number(value.toFixed(2));
}

export function validateEditorialEnrichmentLlmOutput(
  rawText: string,
  sourceInputs: EditorialEnrichmentSourceInputs
): ValidatedEditorialEnrichmentOutput {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJsonText(rawText));
  } catch {
    return {
      ok: false,
      fields: {},
      limitations: [],
      warnings: [],
      error: "LLM output was not valid JSON."
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      fields: {},
      limitations: [],
      warnings: [],
      error: "LLM output must be a JSON object."
    };
  }

  if (hasInternalTerms(parsed)) {
    return {
      ok: false,
      fields: {},
      limitations: [],
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
  const fields: EditorialEnrichmentGeneratedFields = {};
  const whyItMatters = sanitizeString(parsedRecord.whyItMatters, 700);
  const technicalContext = sanitizeString(parsedRecord.technicalContext, 700);
  const whoShouldCare = sanitizeStringArray(parsedRecord.whoShouldCare, 6, 80);
  const impactAreas = sanitizeStringArray(parsedRecord.impactAreas, 6, 80);
  const learningPath = sanitizeStringArray(parsedRecord.learningPath, 6, 180);
  const followUpQuestions = sanitizeStringArray(
    parsedRecord.followUpQuestions,
    6,
    180
  );
  const relatedKnowledgeExplanations = sanitizeExplanationRecord(
    parsedRecord.relatedKnowledgeExplanations,
    sourceInputs.relatedKnowledge.map((item) => item.id),
    420
  );
  const relatedSkillExplanations = sanitizeExplanationRecord(
    parsedRecord.relatedSkillExplanations,
    sourceInputs.relatedSkills.map((item) => item.id),
    420
  );
  const readingDifficulty = sanitizeReadingDifficulty(
    parsedRecord.readingDifficulty
  );

  if (whyItMatters) {
    fields.whyItMatters = whyItMatters;
  }

  if (whoShouldCare) {
    fields.whoShouldCare = whoShouldCare;
  }

  if (technicalContext) {
    fields.technicalContext = technicalContext;
  }

  if (impactAreas) {
    fields.impactAreas = impactAreas;
  }

  if (learningPath) {
    fields.learningPath = learningPath;
  }

  if (relatedKnowledgeExplanations) {
    fields.relatedKnowledgeExplanations = relatedKnowledgeExplanations;
  }

  if (relatedSkillExplanations) {
    fields.relatedSkillExplanations = relatedSkillExplanations;
  }

  if (followUpQuestions) {
    fields.followUpQuestions = followUpQuestions;
  }

  if (readingDifficulty) {
    fields.readingDifficulty = readingDifficulty;
  }

  const limitations =
    sanitizeStringArray(parsedRecord.limitations, 6, 180) ?? [];

  if (Object.keys(fields).length === 0) {
    return {
      ok: false,
      fields,
      limitations,
      warnings,
      error: "LLM output did not contain any usable enrichment fields."
    };
  }

  return {
    ok: true,
    fields,
    confidence: sanitizeConfidence(parsedRecord.confidence),
    limitations,
    warnings,
    error: undefined
  };
}
