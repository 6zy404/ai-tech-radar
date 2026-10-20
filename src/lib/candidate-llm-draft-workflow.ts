import { technologyItems } from "@/data/technologies";
import { topicTags } from "@/data/tags";
import {
  buildCandidateDraftSystemPrompt,
  buildCandidateDraftUserPrompt,
  CANDIDATE_DRAFT_PROMPT_VERSION,
  validateCandidateDraftOutput,
  type CandidateDraftFields,
  type DraftCatalog
} from "@/lib/candidate-llm-draft";
import {
  buildDraftContent,
  buildDraftText
} from "@/lib/candidate-conversion-mapping";
import {
  convertImportedCandidateToDraft,
  getCandidateDraftConversionReadiness,
  getImportedCandidateById
} from "@/lib/candidate-workflow";
import { readTechnologyWorkspaceStore } from "@/lib/candidate-technology-workspace-store";
import { getAllKnowledge, getAllSkills } from "@/lib/content";
import { syncLinkRelationsForEntity } from "@/lib/link-relation-workflow";
import type { LlmProvider } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { fetchSourceText } from "@/lib/source-page-fetch";
import { getTechnologyWorkspacePublishReadiness } from "@/lib/technology-draft-workflow";
import {
  tryRecordWorkflowError,
  tryRecordWorkflowEvent
} from "@/lib/workflow-events";
import type {
  ImportedCandidate,
  TechnologyAiDraftMetadata,
  TechnologyWorkspaceRecord
} from "@/types/content";

/**
 * 「AI 起草」, end to end: read the candidate's primary source, ask the model
 * for the Chinese draft, validate it, and only then convert the candidate —
 * with the generated fields in the same store write. A failure anywhere
 * before the conversion leaves the candidate exactly as it was: no draft, no
 * status change, one `candidate.ai_draft_failed` event.
 *
 * The draft stays `draft`. Nothing here publishes; the publish gate runs when
 * the editor clicks 发布, as for any other draft.
 */

/** Generous: a 1,500-character Chinese body takes DeepSeek 30–60 seconds. */
const DRAFT_LLM_TIMEOUT_MS = 120000;
const SOURCE_FETCH_TIMEOUT_MS = 15000;
const MAX_WARNING_NOTES = 6;

export interface CandidateAiDraftOptions {
  /** Decided on the console with the triage suggestions hidden. */
  blind?: boolean;
  provider?: LlmProvider;
  fetchImpl?: typeof fetch;
  llmTimeoutMs?: number;
}

export type CandidateAiDraftResult =
  | {
      ok: true;
      draft: TechnologyWorkspaceRecord;
      metadata: TechnologyAiDraftMetadata;
      blockingErrors: string[];
      warnings: string[];
    }
  | { ok: false; status: number; error: string };

export function buildDraftCatalog(): DraftCatalog {
  return {
    topics: topicTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      description: tag.description
    })),
    knowledge: getAllKnowledge().map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary
    })),
    skills: getAllSkills().map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary
    }))
  };
}

/**
 * A slug no other technology uses. The model's suggestion first, then a
 * fallback built from the date and the candidate id — the conversion's own
 * `draft-<latin words>` collapses to `draft-` for a Chinese title.
 */
export function resolveDraftSlug(
  suggested: string | undefined,
  candidate: Pick<ImportedCandidate, "id" | "publishDate">,
  draftId: string,
  takenSlugs: Set<string>
): string {
  const suffix = candidate.id
    .replace(/[^a-z0-9]+/gi, "")
    .slice(-6)
    .toLowerCase();
  const base =
    suggested ??
    `signal-${candidate.publishDate.replace(/[^0-9]/g, "")}-${suffix || "draft"}`;

  if (!takenSlugs.has(base)) {
    return base;
  }

  for (let index = 2; index < 20; index += 1) {
    const next = `${base}-${index}`;

    if (!takenSlugs.has(next)) {
      return next;
    }
  }

  return `${base}-${draftId.slice(-6).toLowerCase()}`;
}

function getTakenSlugs(draftId: string): Set<string> {
  return new Set(
    [
      ...technologyItems.map((item) => ({ id: item.id, slug: item.slug })),
      ...readTechnologyWorkspaceStore().records.map((record) => ({
        id: record.id,
        slug: record.slug
      }))
    ]
      .filter((item) => item.id !== draftId)
      .map((item) => item.slug.trim().toLowerCase())
  );
}

function describeOrigin(metadata: TechnologyAiDraftMetadata): string {
  switch (metadata.sourceTextOrigin) {
    case "page":
      return "已读原文网页";
    case "github_release":
      return "已读 GitHub release 说明";
    default:
      return `原文取不到（${metadata.sourceFetchError ?? "未知原因"}），只用了候选自带的标题与摘要`;
  }
}

export function buildAiDraftNotes(
  metadata: TechnologyAiDraftMetadata
): string[] {
  const seconds = Math.round(metadata.latencyMs / 100) / 10;
  const tokens = metadata.tokenUsage?.totalTokens;
  const head = `${metadata.generatedAt.slice(0, 10)} AI 起草：${metadata.modelName} · ${metadata.promptVersion} · ${describeOrigin(metadata)} · ${tokens ? `${tokens} tokens · ` : ""}${seconds} 秒。发布前核对数字、发布方、类型与关联。`;

  return [
    head,
    ...metadata.warnings
      .slice(0, MAX_WARNING_NOTES)
      .map((warning) => `AI 起草提示：${warning}`)
  ];
}

function buildDraftFields(
  candidate: ImportedCandidate,
  fields: CandidateDraftFields,
  metadata: TechnologyAiDraftMetadata,
  slug: string
): Partial<TechnologyWorkspaceRecord> {
  const language = candidate.originalLanguage;
  const explanations = (items: CandidateDraftFields["relatedKnowledge"]) =>
    Object.fromEntries(
      items
        .filter((item) => item.explanation)
        .map((item) => [item.id, item.explanation as string])
    );

  return {
    slug,
    // The original-language fields stay as imported; the model writes zh.
    title: {
      ...buildDraftText(candidate.originalTitle, language),
      zh: fields.title
    },
    summary: {
      ...buildDraftText(
        candidate.originalSummary || candidate.originalTitle,
        language
      ),
      zh: fields.summary
    },
    content: {
      ...buildDraftText(buildDraftContent(candidate), language),
      zh: fields.content
    },
    translationStatus: language === "zh" ? "not_needed" : "done",
    ...(fields.type ? { type: fields.type } : {}),
    ...(fields.publisherName ? { publisherName: fields.publisherName } : {}),
    ...(fields.publisherType ? { publisherType: fields.publisherType } : {}),
    ...(fields.tags.length > 0 ? { tags: fields.tags } : {}),
    relatedKnowledgeIds: fields.relatedKnowledge.map((item) => item.id),
    relatedSkillIds: fields.relatedSkills.map((item) => item.id),
    relatedKnowledgeExplanations: explanations(fields.relatedKnowledge),
    relatedSkillExplanations: explanations(fields.relatedSkills),
    whyItMatters: fields.whyItMatters ?? "",
    whoShouldCare: fields.whoShouldCare ?? [],
    technicalContext: fields.technicalContext ?? "",
    impactAreas: fields.impactAreas ?? [],
    learningPath: fields.learningPath ?? [],
    followUpQuestions: fields.followUpQuestions ?? [],
    readingDifficulty: fields.readingDifficulty ?? "intermediate",
    intelligenceStatus: "draft",
    editorialNotes: [
      `Generated from imported candidate ${candidate.id}.`,
      ...buildAiDraftNotes(metadata)
    ],
    aiDraft: metadata
  };
}

function fail(
  candidate: ImportedCandidate | undefined,
  candidateId: string,
  status: number,
  error: string,
  metadata: Record<string, unknown> = {}
): CandidateAiDraftResult {
  tryRecordWorkflowError({
    entityType: "candidate",
    entityId: candidateId,
    action: "candidate.ai_draft_failed",
    actorType: "workspace_user",
    beforeSnapshot: candidate,
    error: new Error(error),
    metadata: { promptVersion: CANDIDATE_DRAFT_PROMPT_VERSION, ...metadata }
  });

  return { ok: false, status, error };
}

export async function generateCandidateAiDraft(
  candidateId: string,
  options: CandidateAiDraftOptions = {}
): Promise<CandidateAiDraftResult> {
  const candidate = getImportedCandidateById(candidateId);

  if (!candidate) {
    return { ok: false, status: 404, error: "找不到这条候选。" };
  }

  if (
    candidate.convertedTechnologyId ||
    candidate.importStatus === "converted"
  ) {
    return {
      ok: false,
      status: 409,
      error:
        "这条候选已经转为草稿。请打开草稿编辑，或在草稿页用「生成补全建议」。"
    };
  }

  if (!getCandidateDraftConversionReadiness(candidateId).canConvert) {
    return {
      ok: false,
      status: 409,
      error:
        "这条候选在一个重复组里，且不是主候选或该组已有草稿。先到重复组页面处理。"
    };
  }

  const startedAt = Date.now();
  const source = await fetchSourceText(candidate.sourceUrl, {
    fetchImpl: options.fetchImpl,
    timeoutMs: SOURCE_FETCH_TIMEOUT_MS
  });
  const catalog = buildDraftCatalog();
  const provider = options.provider ?? createConfiguredLlmProvider();
  const generationMode =
    provider.name === "mock" ? "mock_llm" : ("llm_assisted" as const);

  let response;

  try {
    response = await provider.generate({
      systemPrompt: buildCandidateDraftSystemPrompt(catalog),
      userPrompt: buildCandidateDraftUserPrompt({
        title: candidate.originalTitle,
        summary: candidate.originalSummary ?? "",
        content: candidate.originalContent ?? "",
        sourceName: candidate.sourceName,
        sourceUrl: candidate.sourceUrl,
        publisherName: candidate.publisherName,
        publishDate: candidate.publishDate,
        sourceLanguage: candidate.originalLanguage,
        ...(source.ok
          ? { sourceText: source.text }
          : { sourceTextError: source.error })
      }),
      timeoutMs: options.llmTimeoutMs ?? DRAFT_LLM_TIMEOUT_MS
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : undefined;
    // The message reaches the editor; the cause (ECONNRESET, a TLS error …)
    // only the server log, so a round can tell a flaky proxy from a bad key.
    console.warn("[ai-draft] model call failed", { candidateId, message, cause });

    return fail(
      candidate,
      candidateId,
      502,
      `AI 起草失败：模型调用出错（${message}）。没有生成草稿，候选保持原状。`,
      { modelName: provider.modelName, latencyMs: Date.now() - startedAt }
    );
  }

  const latencyMs = Date.now() - startedAt;
  const validated = validateCandidateDraftOutput(response.text, catalog);

  if (!validated.ok) {
    return fail(
      candidate,
      candidateId,
      422,
      `AI 起草失败：${validated.error}没有生成草稿，候选保持原状，可以再试一次或手动转为草稿。`,
      {
        modelName: response.modelName,
        latencyMs,
        llmUsage: response.tokenUsage?.totalTokens
      }
    );
  }

  const draftId = `draft-${candidate.id}`;
  const metadata: TechnologyAiDraftMetadata = {
    generationMode,
    providerName: response.providerName,
    modelName: response.modelName,
    promptVersion: CANDIDATE_DRAFT_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceTextOrigin: source.ok ? source.origin : "candidate_fallback",
    ...(source.ok ? {} : { sourceFetchError: source.error }),
    ...(response.tokenUsage ? { tokenUsage: response.tokenUsage } : {}),
    latencyMs,
    warnings: validated.warnings
  };
  const slug = resolveDraftSlug(
    validated.fields.slug,
    candidate,
    draftId,
    getTakenSlugs(draftId)
  );

  let draft: TechnologyWorkspaceRecord;

  try {
    draft = convertImportedCandidateToDraft(candidateId, {
      blind: options.blind,
      draftFields: buildDraftFields(candidate, validated.fields, metadata, slug)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return fail(
      candidate,
      candidateId,
      500,
      `AI 起草失败：转草稿出错（${message}）。`
    );
  }

  // The relation types go to their own store. The draft is already complete
  // without them — a failure here only leaves the pairs on the fallback 关联,
  // which the publish gate then reports.
  try {
    syncLinkRelationsForEntity({ id: draft.id, type: "technology" }, [
      ...validated.fields.relatedKnowledge.map((item) => ({
        toId: item.id,
        toType: "knowledge" as const,
        relationType: item.relationType,
        note: item.note
      })),
      ...validated.fields.relatedSkills.map((item) => ({
        toId: item.id,
        toType: "skill" as const,
        relationType: item.relationType,
        note: item.note
      }))
    ]);
  } catch (error) {
    metadata.warnings.push(
      `关系类型没有写进去（${error instanceof Error ? error.message : String(error)}），请在草稿页逐项选择。`
    );
  }

  tryRecordWorkflowEvent({
    entityType: "candidate",
    entityId: candidateId,
    action: "candidate.ai_drafted",
    actorType: "workspace_user",
    metadata: {
      draftId: draft.id,
      modelName: metadata.modelName,
      promptVersion: metadata.promptVersion,
      generationMode,
      sourceTextOrigin: metadata.sourceTextOrigin,
      latencyMs,
      llmUsage: metadata.tokenUsage?.totalTokens,
      warningCount: metadata.warnings.length,
      ...(options.blind ? { blind: true } : {})
    }
  });

  const readiness = getTechnologyWorkspacePublishReadiness(draft.id);

  return {
    ok: true,
    draft,
    metadata,
    blockingErrors: readiness.blockingErrors.map((issue) => issue.message),
    warnings: readiness.warnings.map((issue) => issue.message)
  };
}
