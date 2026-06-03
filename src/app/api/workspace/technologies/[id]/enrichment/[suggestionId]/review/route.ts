import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { reviewEditorialEnrichmentSuggestion } from "@/lib/editorial-enrichment";
import type { EditorialEnrichmentQualityLabel } from "@/types/content";

interface RouteContext {
  params: Promise<{ id: string; suggestionId: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    const suggestion = reviewEditorialEnrichmentSuggestion(id, suggestionId, {
      qualityScore:
        isRecord(body) && typeof body.qualityScore === "number"
          ? body.qualityScore
          : undefined,
      qualityLabels: isRecord(body) ? parseQualityLabels(body.qualityLabels) : [],
      reviewerNotes:
        isRecord(body) && typeof body.reviewerNotes === "string"
          ? body.reviewerNotes
          : undefined,
      rejectionReason:
        isRecord(body) && typeof body.rejectionReason === "string"
          ? body.rejectionReason
          : undefined
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${id}`);

    return NextResponse.json({ ok: true, suggestion });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown editorial enrichment review error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
