import { NextResponse } from "next/server";

import { generateEditorialEnrichmentSuggestion } from "@/lib/editorial-enrichment";
import type { EditorialEnrichmentGenerationMode } from "@/types/content";

import {
  enrichmentErrorResponse,
  parseEnrichmentFieldNames,
  readEnrichmentBody,
  revalidateEnrichmentPaths
} from "./parse";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseGenerationMode(
  value: unknown
): EditorialEnrichmentGenerationMode {
  if (
    value === "rule_based" ||
    value === "llm_assisted" ||
    value === "mock_llm"
  ) {
    return value;
  }

  return "rule_based";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readEnrichmentBody(request);
    const suggestion = await generateEditorialEnrichmentSuggestion(id, {
      generationMode: parseGenerationMode(body.generationMode),
      fieldsToGenerate: parseEnrichmentFieldNames(body.fieldsToGenerate)
    });

    revalidateEnrichmentPaths(id);

    if (suggestion.outputValidationStatus === "failed") {
      return NextResponse.json(
        {
          ok: false,
          message:
            suggestion.generationError ||
            "Editorial enrichment generation failed validation.",
          suggestion
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, suggestion });
  } catch (error) {
    return enrichmentErrorResponse(
      error,
      "Unknown editorial enrichment generation error."
    );
  }
}
