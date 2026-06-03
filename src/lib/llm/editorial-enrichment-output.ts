import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentSourceInputs,
  ReadingDifficulty
} from "@/types/content";

const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "delivery log",
  "DeliveryLog",
  "audit log",
  "AuditLog",
  "WorkflowEvent",
  "endpointUrl",
  "LLM_API_KEY",
  "WORKSPACE_ACCESS_TOKEN"
];

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

function extractJsonText(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

function hasInternalTerms(value: unknown): boolean {
  const serialized = JSON.stringify(value);

  return internalOnlyTerms.some((term) => serialized.includes(term));
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trim()}...`
    : normalized;
}

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = truncateText(value, maxLength);

  return normalized ? normalized : undefined;
}

function sanitizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => sanitizeString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);

  return items.length > 0 ? items : undefined;
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

function sanitizeReadingDifficulty(value: unknown): ReadingDifficulty | undefined {
  return value === "beginner" || value === "intermediate" || value === "advanced"
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
