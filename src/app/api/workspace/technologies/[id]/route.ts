import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getTechnologyWorkspaceRecordById,
  updateTechnologyWorkspaceRecord,
  type TechnologyWorkspaceRecordUpdate
} from "@/lib/technology-draft-workflow";
import type {
  IntelligenceStatus,
  ImportanceLevel,
  LocalizedText,
  PublisherType,
  ReadingDifficulty,
  SourceLanguage,
  TechnologyType,
  TranslationStatus
} from "@/types/content";

const technologyTypes: TechnologyType[] = [
  "platform",
  "tool",
  "model",
  "protocol",
  "workflow"
];
const sourceLanguages: SourceLanguage[] = ["en", "zh"];
const translationStatuses: TranslationStatus[] = [
  "not_needed",
  "pending",
  "done",
  "failed"
];
const publisherTypes: PublisherType[] = [
  "big-tech",
  "startup",
  "research-lab",
  "open-source-community",
  "media"
];
const importanceLevels: ImportanceLevel[] = ["signal", "important", "critical"];
const readingDifficulties: ReadingDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced"
];
const intelligenceStatuses: IntelligenceStatus[] = [
  "draft",
  "reviewed",
  "needs_enrichment"
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function getEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | undefined {
  return typeof value === "string" && allowedValues.includes(value as T)
    ? (value as T)
    : undefined;
}

function getLocalizedText(value: unknown): LocalizedText | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    original: getString(value.original) ?? "",
    zh: getString(value.zh),
    en: getString(value.en)
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existingRecord = getTechnologyWorkspaceRecordById(id);

    if (!existingRecord) {
      return NextResponse.json(
        { ok: false, message: "Technology workspace record was not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid technology workspace update payload." },
        { status: 400 }
      );
    }

    const updates: TechnologyWorkspaceRecordUpdate = {
      slug: getString(body.slug),
      title: getLocalizedText(body.title),
      summary: getLocalizedText(body.summary),
      content: getLocalizedText(body.content),
      type: getEnumValue(body.type, technologyTypes),
      publishDate: getString(body.publishDate),
      sourceName: getString(body.sourceName),
      sourceUrl: getString(body.sourceUrl),
      sourceLanguage: getEnumValue(body.sourceLanguage, sourceLanguages),
      translationStatus: getEnumValue(
        body.translationStatus,
        translationStatuses
      ),
      publisherName: getString(body.publisherName),
      publisherType: getEnumValue(body.publisherType, publisherTypes),
      importanceLevel: getEnumValue(body.importanceLevel, importanceLevels),
      tags: getStringArray(body.tags),
      relatedKnowledgeIds: getStringArray(body.relatedKnowledgeIds),
      relatedSkillIds: getStringArray(body.relatedSkillIds),
      editorialNotes: getStringArray(body.editorialNotes),
      whyItMatters: getString(body.whyItMatters),
      whoShouldCare: getStringArray(body.whoShouldCare),
      technicalContext: getString(body.technicalContext),
      impactAreas: getStringArray(body.impactAreas),
      learningPath: getStringArray(body.learningPath),
      relatedKnowledgeExplanations: getStringRecord(
        body.relatedKnowledgeExplanations
      ),
      relatedSkillExplanations: getStringRecord(body.relatedSkillExplanations),
      followUpQuestions: getStringArray(body.followUpQuestions),
      readingDifficulty: getEnumValue(body.readingDifficulty, readingDifficulties),
      intelligenceStatus: getEnumValue(
        body.intelligenceStatus,
        intelligenceStatuses
      )
    };
    const record = updateTechnologyWorkspaceRecord(id, updates);

    revalidatePath("/workspace");
    revalidatePath("/workspace/technologies");
    revalidatePath(`/workspace/technologies/${id}`);
    revalidatePath("/technologies");
    revalidatePath(`/technologies/${existingRecord.slug}`);
    revalidatePath(`/technologies/${record.slug}`);
    revalidatePath("/digest/today");
    revalidatePath("/");

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown technology workspace update error.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
