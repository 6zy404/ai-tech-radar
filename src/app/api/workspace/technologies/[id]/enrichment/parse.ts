import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { EditorialEnrichmentReviewInput } from "@/lib/editorial-enrichment";
import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentQualityLabel
} from "@/types/content";

// Request parsing shared by the enrichment routes (generate, apply, reject,
// review). Each of them used to carry its own copy of these helpers.

type EnrichmentFieldName = keyof EditorialEnrichmentGeneratedFields;

const enrichmentFieldNames = new Set<EnrichmentFieldName>([
  "whyItMatters",
  "whoShouldCare",
  "technicalContext",
  "impactAreas",
  "learningPath",
  "relatedKnowledgeExplanations",
  "relatedSkillExplanations",
  "followUpQuestions",
  "readingDifficulty"
]);

const qualityLabels = new Set<EditorialEnrichmentQualityLabel>([
  "accurate",
  "clear",
  "too_generic",
  "too_verbose",
  "missing_context",
  "hallucination_risk",
  "needs_human_edit",
  "good_enough"
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readEnrichmentBody(
  request: Request
): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}));

  return isRecord(body) ? body : {};
}

export function parseEnrichmentFieldNames(
  value: unknown
): EnrichmentFieldName[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(
    (item): item is EnrichmentFieldName =>
      typeof item === "string" &&
      enrichmentFieldNames.has(item as EnrichmentFieldName)
  );
}

function parseQualityLabels(value: unknown): EditorialEnrichmentQualityLabel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is EditorialEnrichmentQualityLabel =>
      typeof item === "string" &&
      qualityLabels.has(item as EditorialEnrichmentQualityLabel)
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseEnrichmentReviewInput(
  body: Record<string, unknown>
): EditorialEnrichmentReviewInput {
  return {
    qualityScore:
      typeof body.qualityScore === "number" ? body.qualityScore : undefined,
    qualityLabels: parseQualityLabels(body.qualityLabels),
    reviewerNotes: optionalString(body.reviewerNotes),
    rejectionReason: optionalString(body.rejectionReason)
  };
}

export function revalidateEnrichmentPaths(technologyId: string) {
  revalidatePath("/workspace");
  revalidatePath("/workspace/technologies");
  revalidatePath(`/workspace/technologies/${technologyId}`);
}

export function enrichmentErrorResponse(
  error: unknown,
  fallbackMessage: string
) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  return NextResponse.json({ ok: false, message }, { status: 500 });
}
