import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { generateEditorialEnrichmentSuggestion } from "@/lib/editorial-enrichment";
import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentGenerationMode
} from "@/types/content";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function parseFieldsToGenerate(
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const generationMode = isRecord(body)
      ? parseGenerationMode(body.generationMode)
      : "rule_based";
    const suggestion = await generateEditorialEnrichmentSuggestion(id, {
      generationMode,
      fieldsToGenerate: isRecord(body)
        ? parseFieldsToGenerate(body.fieldsToGenerate)
        : undefined
    });

    revalidatePath("/workspace");
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${id}`);

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
    const message =
      error instanceof Error
        ? error.message
        : "Unknown editorial enrichment generation error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
