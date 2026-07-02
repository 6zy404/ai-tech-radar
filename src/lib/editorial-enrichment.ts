import { createHash, randomUUID } from "node:crypto";

import {
  getAllKnowledge,
  getAllSkills,
  getTechnologyWorkspaceRecordById
} from "@/lib/content";
import {
  updateTechnologyWorkspaceRecord,
  type TechnologyWorkspaceRecordUpdate
} from "@/lib/technology-draft-workflow";
import {
  getEditorialEnrichmentSuggestionById,
  getEditorialEnrichmentSuggestions,
  saveEditorialEnrichmentSuggestions,
  upsertEditorialEnrichmentSuggestion
} from "@/lib/editorial-enrichment-store";
import { validateEditorialEnrichmentLlmOutput } from "@/lib/llm/editorial-enrichment-output";
import { getLlmProviderConfig } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { buildEditorialEnrichmentPrompt } from "@/lib/llm/prompts/editorial-enrichment";
import {
  ensureDefaultPromptVersion,
  getActivePromptVersion
} from "@/lib/prompt-versions";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentGenerationMode,
  EditorialEnrichmentQualityLabel,
  EditorialEnrichmentReferenceInput,
  EditorialEnrichmentReviewStatus,
  EditorialEnrichmentSourceInputs,
  EditorialEnrichmentSuggestion,
  KnowledgeItem,
  ReadingDifficulty,
  SkillItem,
  TechnologyWorkspaceRecord
} from "@/types/content";

type EditorialEnrichmentFieldName = keyof EditorialEnrichmentGeneratedFields;

interface GenerateEditorialEnrichmentOptions {
  generationMode?: EditorialEnrichmentGenerationMode;
  fieldsToGenerate?: EditorialEnrichmentFieldName[];
}

export interface EditorialEnrichmentReviewInput {
  qualityScore?: number;
  qualityLabels?: EditorialEnrichmentQualityLabel[];
  reviewerNotes?: string;
  rejectionReason?: string;
}

export interface ApplyEditorialEnrichmentOptions extends EditorialEnrichmentReviewInput {
  fieldsToApply?: EditorialEnrichmentFieldName[];
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function normalizeQualityScore(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function normalizeQualityLabels(
  labels: EditorialEnrichmentQualityLabel[] | undefined
): EditorialEnrichmentQualityLabel[] {
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

  return Array.from(
    new Set((labels ?? []).filter((label) => allowedLabels.has(label)))
  );
}

function getReviewPatch(
  input: EditorialEnrichmentReviewInput = {}
): Pick<
  EditorialEnrichmentSuggestion,
  "qualityScore" | "qualityLabels" | "reviewerNotes" | "rejectionReason"
> {
  return {
    qualityScore: normalizeQualityScore(input.qualityScore),
    qualityLabels: normalizeQualityLabels(input.qualityLabels),
    reviewerNotes: input.reviewerNotes?.trim() || undefined,
    rejectionReason: input.rejectionReason?.trim() || undefined
  };
}

function getDisplayText(value: { original?: string; zh?: string }): string {
  return value.zh?.trim() || value.original?.trim() || "";
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function getInputSignature(input: Omit<EditorialEnrichmentSourceInputs, "inputSignature">): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function getRelatedKnowledge(
  record: TechnologyWorkspaceRecord
): EditorialEnrichmentReferenceInput[] {
  const knowledgeById = new Map(getAllKnowledge().map((item) => [item.id, item]));

  return record.relatedKnowledgeIds
    .map((id) => knowledgeById.get(id))
    .filter((item): item is KnowledgeItem => Boolean(item))
    .map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary
    }));
}

function getRelatedSkills(
  record: TechnologyWorkspaceRecord
): EditorialEnrichmentReferenceInput[] {
  const skillById = new Map(getAllSkills().map((item) => [item.id, item]));

  return record.relatedSkillIds
    .map((id) => skillById.get(id))
    .filter((item): item is SkillItem => Boolean(item))
    .map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary
    }));
}

function buildSourceInputs(record: TechnologyWorkspaceRecord): EditorialEnrichmentSourceInputs {
  const ranking = evaluateTechnologyPriority(record);
  const inputWithoutSignature = {
    title: record.title,
    summary: record.summary,
    contentPreview: truncateText(
      getDisplayText(record.content) || record.content.original,
      520
    ),
    sourceName: record.sourceName,
    publisherName: record.publisherName,
    sourceLanguage: record.sourceLanguage,
    tags: [...record.tags],
    priorityLevel: ranking.priorityLevel,
    priorityReasons: ranking.priorityReasons,
    relatedKnowledge: getRelatedKnowledge(record),
    relatedSkills: getRelatedSkills(record)
  };

  return {
    ...inputWithoutSignature,
    inputSignature: getInputSignature(inputWithoutSignature)
  };
}

function inferAudience(record: TechnologyWorkspaceRecord): string[] {
  const tokens = [
    record.type,
    ...record.tags,
    ...record.relatedSkillIds,
    ...record.relatedKnowledgeIds,
    getDisplayText(record.title)
  ]
    .join(" ")
    .toLowerCase();
  const audience = new Set<string>();

  if (tokens.includes("agent") || tokens.includes("workflow")) {
    audience.add("agent developer");
    audience.add("AI engineer");
  }

  if (tokens.includes("retrieval") || tokens.includes("rag")) {
    audience.add("retrieval engineer");
  }

  if (tokens.includes("eval") || tokens.includes("observability")) {
    audience.add("AI evaluation lead");
  }

  if (tokens.includes("product") || tokens.includes("enterprise")) {
    audience.add("product builder");
    audience.add("technical manager");
  }

  if (tokens.includes("infra") || tokens.includes("model")) {
    audience.add("infra engineer");
  }

  if (audience.size === 0) {
    audience.add("AI engineer");
    audience.add("product builder");
  }

  return Array.from(audience).slice(0, 4);
}

function inferImpactAreas(record: TechnologyWorkspaceRecord): string[] {
  const tokens = [
    record.type,
    ...record.tags,
    ...record.relatedSkillIds,
    ...record.relatedKnowledgeIds
  ]
    .join(" ")
    .toLowerCase();
  const areas = new Set<string>();

  if (tokens.includes("agent") || tokens.includes("workflow")) {
    areas.add("agent workflow");
  }

  if (tokens.includes("tool") || tokens.includes("developer")) {
    areas.add("developer tools");
  }

  if (tokens.includes("retrieval") || tokens.includes("rag")) {
    areas.add("retrieval systems");
  }

  if (tokens.includes("eval") || tokens.includes("observability")) {
    areas.add("evaluation");
  }

  if (tokens.includes("enterprise") || tokens.includes("product")) {
    areas.add("enterprise AI adoption");
  }

  if (record.type === "model") {
    areas.add("model serving");
  }

  if (areas.size === 0) {
    areas.add("AI product development");
  }

  return Array.from(areas).slice(0, 4);
}

function inferReadingDifficulty(
  record: TechnologyWorkspaceRecord,
  sourceInputs: EditorialEnrichmentSourceInputs
): ReadingDifficulty {
  if (record.readingDifficulty) {
    return record.readingDifficulty;
  }

  if (
    sourceInputs.relatedKnowledge.some((item) =>
      item.title.toLowerCase().includes("advanced")
    ) ||
    sourceInputs.contentPreview.length > 420
  ) {
    return "advanced";
  }

  if (sourceInputs.relatedKnowledge.length === 0 && record.tags.length <= 1) {
    return "beginner";
  }

  return "intermediate";
}

function buildGeneratedFields(
  record: TechnologyWorkspaceRecord,
  sourceInputs: EditorialEnrichmentSourceInputs
): EditorialEnrichmentGeneratedFields {
  const title = getDisplayText(record.title);
  const summary = getDisplayText(record.summary);
  const firstReason =
    sourceInputs.priorityReasons[0] ??
    "it may affect how teams evaluate and adopt new AI capabilities";
  const relatedKnowledgeTitles = sourceInputs.relatedKnowledge
    .map((item) => item.title)
    .slice(0, 3);
  const relatedSkillTitles = sourceInputs.relatedSkills
    .map((item) => item.title)
    .slice(0, 3);
  const relatedKnowledgeExplanations = Object.fromEntries(
    sourceInputs.relatedKnowledge.map((item) => [
      item.id,
      `${item.title} gives readers the background needed to interpret ${title} beyond the headline.`
    ])
  );
  const relatedSkillExplanations = Object.fromEntries(
    sourceInputs.relatedSkills.map((item) => [
      item.id,
      `${item.title} helps teams evaluate or apply this signal in a real product or engineering workflow.`
    ])
  );

  return {
    whyItMatters: `${title} is worth watching because ${firstReason.toLowerCase()}. ${truncateText(summary, 180)}`,
    whoShouldCare: inferAudience(record),
    technicalContext:
      relatedKnowledgeTitles.length > 0
        ? `This signal sits in the context of ${relatedKnowledgeTitles.join(", ")} and should be read as part of the broader shift in practical AI system design.`
        : `This signal belongs to the ${record.type} layer and should be read as a practical indicator of how AI capabilities are being packaged for teams.`,
    impactAreas: inferImpactAreas(record),
    learningPath: [
      `Start with the source from ${record.sourceName} to understand what changed.`,
      relatedKnowledgeTitles.length > 0
        ? `Review background knowledge: ${relatedKnowledgeTitles.join(", ")}.`
        : "Identify the underlying concept before comparing vendors or implementations.",
      relatedSkillTitles.length > 0
        ? `Map it to practical skills: ${relatedSkillTitles.join(", ")}.`
        : "Decide which workflow or evaluation skill is needed before adoption.",
      "Decide whether this deserves a small pilot, a watch note, or no immediate action."
    ],
    relatedKnowledgeExplanations,
    relatedSkillExplanations,
    followUpQuestions: [
      `What problem does ${title} solve better than the current approach?`,
      "Which team or workflow would feel the impact first?",
      "What evidence would make this worth piloting rather than only tracking?"
    ],
    readingDifficulty: inferReadingDifficulty(record, sourceInputs)
  };
}

function filterGeneratedFields(
  fields: EditorialEnrichmentGeneratedFields,
  fieldsToGenerate?: EditorialEnrichmentFieldName[]
): EditorialEnrichmentGeneratedFields {
  if (!fieldsToGenerate || fieldsToGenerate.length === 0) {
    return fields;
  }

  const allowedFields = new Set(fieldsToGenerate);

  return Object.fromEntries(
    Object.entries(fields).filter(([key]) =>
      allowedFields.has(key as EditorialEnrichmentFieldName)
    )
  ) as EditorialEnrichmentGeneratedFields;
}

function getAppliedGeneratedFields(
  fields: EditorialEnrichmentGeneratedFields,
  fieldsToApply?: EditorialEnrichmentFieldName[]
): EditorialEnrichmentGeneratedFields {
  return filterGeneratedFields(fields, fieldsToApply);
}

function getReviewStatusForApply(input: {
  generatedFields: EditorialEnrichmentGeneratedFields;
  appliedFields: EditorialEnrichmentFieldName[];
}): EditorialEnrichmentReviewStatus {
  const generatedFieldCount = Object.keys(input.generatedFields).length;

  if (
    generatedFieldCount > 0 &&
    input.appliedFields.length > 0 &&
    input.appliedFields.length < generatedFieldCount
  ) {
    return "partially_accepted";
  }

  return "accepted";
}

function getRuleBasedSuggestionMetadata(
  fields: EditorialEnrichmentGeneratedFields
): Pick<
  EditorialEnrichmentSuggestion,
  | "providerName"
  | "outputValidationStatus"
  | "outputValidationWarnings"
  | "confidence"
  | "limitations"
> {
  return {
    providerName: "rule_based",
    outputValidationStatus:
      Object.keys(fields).length > 0 ? "valid" : "failed",
    outputValidationWarnings:
      Object.keys(fields).length > 0
        ? []
        : ["Rule-based generation did not produce usable fields."],
    confidence: 0.65,
    limitations: [
      "Generated by deterministic rules; editor review is still required."
    ]
  };
}

function createFailedSuggestion(input: {
  technologyDraftId: string;
  sourceInputs: EditorialEnrichmentSourceInputs;
  generationMode: EditorialEnrichmentGenerationMode;
  providerName?: string;
  modelName?: string;
  promptVersionId?: string;
  promptVersion?: string;
  generationError: string;
  validationWarnings?: string[];
}): EditorialEnrichmentSuggestion {
  const now = getTimestamp();

  return {
    id: `editorial-enrichment-${randomUUID()}`,
    technologyDraftId: input.technologyDraftId,
    status: "draft",
    generatedFields: {},
    sourceInputs: input.sourceInputs,
    generationMode: input.generationMode,
    providerName: input.providerName,
    modelName: input.modelName,
    promptVersionId: input.promptVersionId,
    promptVersion: input.promptVersion,
    outputValidationStatus: "failed",
    outputValidationWarnings: input.validationWarnings ?? [],
    limitations: [],
    generationError: input.generationError,
    reviewStatus: "unreviewed",
    qualityLabels: [],
    appliedFields: [],
    createdAt: now,
    updatedAt: now
  };
}

async function buildLlmGeneratedSuggestion(input: {
  record: TechnologyWorkspaceRecord;
  sourceInputs: EditorialEnrichmentSourceInputs;
  requestedMode: EditorialEnrichmentGenerationMode;
  fieldsToGenerate?: EditorialEnrichmentFieldName[];
}): Promise<EditorialEnrichmentSuggestion> {
  const config = getLlmProviderConfig();
  const provider = createConfiguredLlmProvider();
  const { systemPrompt, userPrompt, promptVersion, promptVersionId } =
    buildEditorialEnrichmentPrompt({
      record: input.record,
      sourceInputs: input.sourceInputs
    });
  const actualGenerationMode: EditorialEnrichmentGenerationMode =
    input.requestedMode === "llm_assisted" &&
    config.provider === "openai_compatible"
      ? "llm_assisted"
      : "mock_llm";

  try {
    const response = await provider.generate({
      systemPrompt,
      userPrompt,
      timeoutMs: config.timeoutMs
    });
    const validation = validateEditorialEnrichmentLlmOutput(
      response.text,
      input.sourceInputs
    );

    if (!validation.ok) {
      return createFailedSuggestion({
        technologyDraftId: input.record.id,
        sourceInputs: input.sourceInputs,
        generationMode: actualGenerationMode,
        providerName: response.providerName,
        modelName: response.modelName,
        promptVersionId,
        promptVersion,
        generationError: validation.error ?? "LLM output failed validation.",
        validationWarnings: validation.warnings
      });
    }

    const now = getTimestamp();
    const generatedFields = filterGeneratedFields(
      validation.fields,
      input.fieldsToGenerate
    );

    return {
      id: `editorial-enrichment-${randomUUID()}`,
      technologyDraftId: input.record.id,
      status: "draft",
      generatedFields,
      sourceInputs: input.sourceInputs,
      generationMode: actualGenerationMode,
      providerName: response.providerName,
      modelName: response.modelName,
      promptVersionId,
      promptVersion,
      outputValidationStatus:
        validation.warnings.length > 0 ? "warning" : "valid",
      outputValidationWarnings: validation.warnings,
      confidence: validation.confidence,
      limitations: validation.limitations,
      tokenUsage: response.tokenUsage,
      reviewStatus: "unreviewed",
      qualityLabels: [],
      appliedFields: [],
      createdAt: now,
      updatedAt: now
    };
  } catch (error) {
    return createFailedSuggestion({
      technologyDraftId: input.record.id,
      sourceInputs: input.sourceInputs,
      generationMode: actualGenerationMode,
      providerName: provider.name,
      modelName: provider.modelName,
      promptVersionId,
      promptVersion,
      generationError:
        error instanceof Error
          ? error.message
          : "LLM provider failed while generating a suggestion."
    });
  }
}

function markOlderDraftSuggestionsStale(
  technologyDraftId: string,
  inputSignature: string
): EditorialEnrichmentSuggestion[] {
  const now = getTimestamp();
  let changed = false;
  const suggestions = getEditorialEnrichmentSuggestions().map((suggestion) => {
    if (
      suggestion.technologyDraftId !== technologyDraftId ||
      suggestion.status !== "draft" ||
      suggestion.sourceInputs.inputSignature === inputSignature
    ) {
      return suggestion;
    }

    changed = true;

    tryRecordWorkflowEvent({
      entityType: "technology_draft",
      entityId: technologyDraftId,
      action: "editorial_enrichment.stale",
      actorType: "system",
      beforeSnapshot: suggestion,
      afterSnapshot: {
        ...suggestion,
        status: "stale",
        updatedAt: now
      },
      metadata: {
        suggestionId: suggestion.id,
        previousInputSignature: suggestion.sourceInputs.inputSignature,
        currentInputSignature: inputSignature
      }
    });
    tryRecordWorkflowEvent({
      entityType: "technology_draft",
      entityId: technologyDraftId,
      action: "enrichment_suggestion.marked_stale",
      actorType: "system",
      metadata: {
        suggestionId: suggestion.id,
        previousInputSignature: suggestion.sourceInputs.inputSignature,
        currentInputSignature: inputSignature
      }
    });

    return {
      ...suggestion,
      status: "stale" as const,
      updatedAt: now
    };
  });

  if (changed) {
    saveEditorialEnrichmentSuggestions(suggestions);
  }

  return suggestions;
}

export async function generateEditorialEnrichmentSuggestion(
  technologyDraftId: string,
  options: GenerateEditorialEnrichmentOptions | EditorialEnrichmentGenerationMode = {}
): Promise<EditorialEnrichmentSuggestion> {
  ensureDefaultPromptVersion();
  const generationMode =
    typeof options === "string" ? options : options.generationMode ?? "rule_based";
  const fieldsToGenerate =
    typeof options === "string" ? undefined : options.fieldsToGenerate;
  const record = getTechnologyWorkspaceRecordById(technologyDraftId);

  if (!record) {
    throw new Error("Technology workspace record was not found.");
  }

  const sourceInputs = buildSourceInputs(record);
  markOlderDraftSuggestionsStale(technologyDraftId, sourceInputs.inputSignature);

  const now = getTimestamp();
  const activePromptVersion = getActivePromptVersion("editorial_enrichment");
  const generatedFields = filterGeneratedFields(
    buildGeneratedFields(record, sourceInputs),
    fieldsToGenerate
  );
  const suggestion: EditorialEnrichmentSuggestion =
    generationMode === "llm_assisted" || generationMode === "mock_llm"
      ? await buildLlmGeneratedSuggestion({
          record,
          sourceInputs,
          requestedMode: generationMode,
          fieldsToGenerate
        })
      : {
          id: `editorial-enrichment-${randomUUID()}`,
          technologyDraftId,
          status: "draft",
          generatedFields,
          sourceInputs,
          generationMode: "rule_based",
          promptVersionId: activePromptVersion.id,
          promptVersion: activePromptVersion.version,
          reviewStatus: "unreviewed",
          qualityLabels: [],
          appliedFields: [],
          createdAt: now,
          updatedAt: now,
          ...getRuleBasedSuggestionMetadata(generatedFields)
        };

  upsertEditorialEnrichmentSuggestion(suggestion);
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action:
      suggestion.outputValidationStatus === "failed"
        ? "editorial_enrichment.failed"
        : "editorial_enrichment.generated",
    actorType: "system",
    afterSnapshot: suggestion,
    metadata: {
      suggestionId: suggestion.id,
      generationMode: suggestion.generationMode,
      inputSignature: sourceInputs.inputSignature,
      providerName: suggestion.providerName,
      modelName: suggestion.modelName,
      promptVersionId: suggestion.promptVersionId,
      promptVersion: suggestion.promptVersion,
      outputValidationStatus: suggestion.outputValidationStatus,
      hasGenerationError: Boolean(suggestion.generationError)
    }
  });
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action: "enrichment_suggestion.generated",
    actorType: "system",
    metadata: {
      suggestionId: suggestion.id,
      generationMode: suggestion.generationMode,
      inputSignature: sourceInputs.inputSignature,
      providerName: suggestion.providerName,
      modelName: suggestion.modelName,
      promptVersionId: suggestion.promptVersionId,
      promptVersion: suggestion.promptVersion,
      outputValidationStatus: suggestion.outputValidationStatus,
      hasGenerationError: Boolean(suggestion.generationError)
    }
  });

  return suggestion;
}

export function applyEditorialEnrichmentSuggestion(
  technologyDraftId: string,
  suggestionId: string,
  options: ApplyEditorialEnrichmentOptions = {}
): {
  suggestion: EditorialEnrichmentSuggestion;
  record: TechnologyWorkspaceRecord;
} {
  const suggestion = getEditorialEnrichmentSuggestionById(suggestionId);
  const record = getTechnologyWorkspaceRecordById(technologyDraftId);

  if (!record) {
    throw new Error("Technology workspace record was not found.");
  }

  if (!suggestion || suggestion.technologyDraftId !== technologyDraftId) {
    throw new Error("Editorial enrichment suggestion was not found.");
  }

  if (record.status !== "draft") {
    throw new Error(
      "Editorial enrichment suggestions can only be applied to draft records."
    );
  }

  if (suggestion.status === "applied") {
    throw new Error("Editorial enrichment suggestion has already been applied.");
  }

  if (suggestion.status === "rejected") {
    throw new Error("Rejected editorial enrichment suggestions cannot be applied.");
  }

  if (suggestion.outputValidationStatus === "failed") {
    throw new Error("Failed editorial enrichment suggestions cannot be applied.");
  }

  const generatedFieldsToApply = getAppliedGeneratedFields(
    suggestion.generatedFields,
    options.fieldsToApply
  );
  const appliedFields = Object.keys(
    generatedFieldsToApply
  ) as EditorialEnrichmentFieldName[];

  if (appliedFields.length === 0) {
    throw new Error("No editorial enrichment fields were selected for apply.");
  }

  const updates: TechnologyWorkspaceRecordUpdate = {
    ...generatedFieldsToApply,
    intelligenceStatus: "draft"
  };
  const updatedRecord = updateTechnologyWorkspaceRecord(technologyDraftId, updates);
  const now = getTimestamp();
  const reviewPatch = getReviewPatch(options);
  const updatedSuggestion: EditorialEnrichmentSuggestion = {
    ...suggestion,
    status: "applied",
    reviewStatus: getReviewStatusForApply({
      generatedFields: suggestion.generatedFields,
      appliedFields
    }),
    qualityScore: reviewPatch.qualityScore ?? suggestion.qualityScore,
    qualityLabels: reviewPatch.qualityLabels ?? suggestion.qualityLabels ?? [],
    reviewerNotes: reviewPatch.reviewerNotes ?? suggestion.reviewerNotes,
    appliedFields,
    reviewedAt: now,
    appliedAt: now,
    updatedAt: now
  };

  upsertEditorialEnrichmentSuggestion(updatedSuggestion);
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action: "editorial_enrichment.applied",
    actorType: "workspace_user",
    beforeSnapshot: record,
    afterSnapshot: updatedRecord,
    metadata: {
      suggestionId,
      appliedFields,
      reviewStatus: updatedSuggestion.reviewStatus,
      qualityScore: updatedSuggestion.qualityScore,
      qualityLabels: updatedSuggestion.qualityLabels
    }
  });
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action: "enrichment_suggestion.applied",
    actorType: "workspace_user",
    metadata: {
      suggestionId,
      appliedFields,
      reviewStatus: updatedSuggestion.reviewStatus,
      qualityScore: updatedSuggestion.qualityScore,
      qualityLabels: updatedSuggestion.qualityLabels,
      promptVersionId: updatedSuggestion.promptVersionId
    }
  });

  return {
    suggestion: updatedSuggestion,
    record: updatedRecord
  };
}

export function rejectEditorialEnrichmentSuggestion(
  technologyDraftId: string,
  suggestionId: string,
  review: string | EditorialEnrichmentReviewInput = ""
): EditorialEnrichmentSuggestion {
  const suggestion = getEditorialEnrichmentSuggestionById(suggestionId);

  if (!suggestion || suggestion.technologyDraftId !== technologyDraftId) {
    throw new Error("Editorial enrichment suggestion was not found.");
  }

  if (suggestion.status === "applied") {
    throw new Error("Applied editorial enrichment suggestions cannot be rejected.");
  }

  const now = getTimestamp();
  const reviewInput =
    typeof review === "string" ? { reviewerNotes: review } : review;
  const reviewPatch = getReviewPatch(reviewInput);
  const updatedSuggestion: EditorialEnrichmentSuggestion = {
    ...suggestion,
    status: "rejected",
    reviewStatus: "rejected",
    qualityScore: reviewPatch.qualityScore ?? suggestion.qualityScore,
    qualityLabels: reviewPatch.qualityLabels ?? suggestion.qualityLabels ?? [],
    reviewerNotes: reviewPatch.reviewerNotes ?? suggestion.reviewerNotes,
    rejectionReason: reviewPatch.rejectionReason ?? suggestion.rejectionReason,
    reviewedAt: now,
    rejectedAt: now,
    updatedAt: now
  };

  upsertEditorialEnrichmentSuggestion(updatedSuggestion);
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action: "editorial_enrichment.rejected",
    actorType: "workspace_user",
    beforeSnapshot: suggestion,
    afterSnapshot: updatedSuggestion,
    metadata: {
      suggestionId,
      hasReviewerNotes: Boolean(reviewPatch.reviewerNotes),
      hasRejectionReason: Boolean(reviewPatch.rejectionReason),
      qualityScore: updatedSuggestion.qualityScore,
      qualityLabels: updatedSuggestion.qualityLabels
    }
  });
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action: "enrichment_suggestion.rejected",
    actorType: "workspace_user",
    metadata: {
      suggestionId,
      hasReviewerNotes: Boolean(reviewPatch.reviewerNotes),
      hasRejectionReason: Boolean(reviewPatch.rejectionReason),
      qualityScore: updatedSuggestion.qualityScore,
      qualityLabels: updatedSuggestion.qualityLabels,
      promptVersionId: updatedSuggestion.promptVersionId
    }
  });

  return updatedSuggestion;
}

export function reviewEditorialEnrichmentSuggestion(
  technologyDraftId: string,
  suggestionId: string,
  review: EditorialEnrichmentReviewInput
): EditorialEnrichmentSuggestion {
  const suggestion = getEditorialEnrichmentSuggestionById(suggestionId);

  if (!suggestion || suggestion.technologyDraftId !== technologyDraftId) {
    throw new Error("Editorial enrichment suggestion was not found.");
  }

  const now = getTimestamp();
  const reviewPatch = getReviewPatch(review);
  const updatedSuggestion: EditorialEnrichmentSuggestion = {
    ...suggestion,
    reviewStatus: suggestion.reviewStatus ?? "unreviewed",
    qualityScore: reviewPatch.qualityScore ?? suggestion.qualityScore,
    qualityLabels: reviewPatch.qualityLabels ?? suggestion.qualityLabels ?? [],
    reviewerNotes: reviewPatch.reviewerNotes ?? suggestion.reviewerNotes,
    rejectionReason: reviewPatch.rejectionReason ?? suggestion.rejectionReason,
    reviewedAt: now,
    updatedAt: now
  };

  upsertEditorialEnrichmentSuggestion(updatedSuggestion);
  tryRecordWorkflowEvent({
    entityType: "technology_draft",
    entityId: technologyDraftId,
    action: "enrichment_suggestion.reviewed",
    actorType: "workspace_user",
    beforeSnapshot: suggestion,
    afterSnapshot: updatedSuggestion,
    metadata: {
      suggestionId,
      reviewStatus: updatedSuggestion.reviewStatus,
      qualityScore: updatedSuggestion.qualityScore,
      qualityLabels: updatedSuggestion.qualityLabels,
      hasReviewerNotes: Boolean(updatedSuggestion.reviewerNotes),
      hasRejectionReason: Boolean(updatedSuggestion.rejectionReason),
      promptVersionId: updatedSuggestion.promptVersionId
    }
  });

  return updatedSuggestion;
}
