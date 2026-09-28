import { NextResponse } from "next/server";

import { rejectEditorialEnrichmentSuggestion } from "@/lib/editorial-enrichment";

import {
  enrichmentErrorResponse,
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
    const suggestion = rejectEditorialEnrichmentSuggestion(
      id,
      suggestionId,
      parseEnrichmentReviewInput(body)
    );

    revalidateEnrichmentPaths(id);

    return NextResponse.json({ ok: true, suggestion });
  } catch (error) {
    return enrichmentErrorResponse(
      error,
      "Unknown editorial enrichment reject error."
    );
  }
}
