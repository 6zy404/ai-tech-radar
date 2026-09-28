import { NextResponse } from "next/server";

import { applyEditorialEnrichmentSuggestion } from "@/lib/editorial-enrichment";

import {
  enrichmentErrorResponse,
  parseEnrichmentFieldNames,
  parseEnrichmentReviewInput,
  readEnrichmentBody,
  revalidateEnrichmentPaths
} from "../../parse";

interface RouteContext {
  params: Promise<{ id: string; suggestionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id, suggestionId } = await context.params;
    const body = await readEnrichmentBody(request);
    // Applying never records a rejection reason, so that field is not read.
    const { qualityScore, qualityLabels, reviewerNotes } =
      parseEnrichmentReviewInput(body);
    const result = applyEditorialEnrichmentSuggestion(id, suggestionId, {
      fieldsToApply: parseEnrichmentFieldNames(body.fieldsToApply),
      qualityScore,
      qualityLabels,
      reviewerNotes
    });

    revalidateEnrichmentPaths(id);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return enrichmentErrorResponse(
      error,
      "Unknown editorial enrichment apply error."
    );
  }
}
