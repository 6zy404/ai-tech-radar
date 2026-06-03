import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { applyEditorialEnrichmentSuggestion } from "@/lib/editorial-enrichment";
import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentQualityLabel
} from "@/types/content";

interface RouteContext {
  params: Promise<{ id: string; suggestionId: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseFieldsToApply(
  value: unknown
): Array<keyof EditorialEnrichmentGeneratedFields> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const allowedFields = new Set<keyof EditorialEnrichmentGeneratedFields>([
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

  return value.filter(
    (item): item is keyof EditorialEnrichmentGeneratedFields =>
      typeof item === "string" &&
      allowedFields.has(item as keyof EditorialEnrichmentGeneratedFields)
  );
}

function parseQualityLabels(value: unknown): EditorialEnrichmentQualityLabel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedLabels = new Set<EditorialEnrichmentQualityLabel>([
    "accurate",
    "clear",
    "too_generic",
    "too_verbose",
    "missing_context",
    "hallucination_risk",
    "needs_human_edit",
    "good_enough"
  ]);

  return value.filter(
    (item): item is EditorialEnrichmentQualityLabel =>
      typeof item === "string" &&
      allowedLabels.has(item as EditorialEnrichmentQualityLabel)
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id, suggestionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = applyEditorialEnrichmentSuggestion(id, suggestionId, {
      fieldsToApply: isRecord(body)
        ? parseFieldsToApply(body.fieldsToApply)
        : undefined,
      qualityScore:
        isRecord(body) && typeof body.qualityScore === "number"
          ? body.qualityScore
          : undefined,
      qualityLabels: isRecord(body)
        ? parseQualityLabels(body.qualityLabels)
        : [],
      reviewerNotes:
        isRecord(body) && typeof body.reviewerNotes === "string"
          ? body.reviewerNotes
          : undefined
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${id}`);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown editorial enrichment apply error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
