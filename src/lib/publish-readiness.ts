import { technologyItems } from "@/data/technologies";
import { getEditorialEnrichmentReadinessState } from "@/lib/editorial-enrichment-store";
import type {
  ImportanceLevel,
  PublisherType,
  SourceLanguage,
  TechnologyItem,
  TechnologyStatus,
  TechnologyType,
  TechnologyWorkspaceRecord,
  TranslationStatus
} from "@/types/content";

export type PublishReadinessSeverity = "blocking" | "warning";

export interface PublishReadinessIssue {
  code: string;
  field: string;
  message: string;
  severity: PublishReadinessSeverity;
}

export interface PublishReadinessResult {
  isReady: boolean;
  blockingErrors: PublishReadinessIssue[];
  warnings: PublishReadinessIssue[];
}

export class PublishReadinessError extends Error {
  readiness: PublishReadinessResult;

  constructor(readiness: PublishReadinessResult) {
    super("Technology workspace record is not ready to publish.");
    this.name = "PublishReadinessError";
    this.readiness = readiness;
  }
}

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
const technologyStatuses: TechnologyStatus[] = [
  "draft",
  "published",
  "archived"
];

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function getLocalizedLength(value: { original?: string; zh?: string }): number {
  return Math.max(
    value.original?.trim().length ?? 0,
    value.zh?.trim().length ?? 0
  );
}

function isValidHttpUrl(value: string | undefined): boolean {
  if (!hasText(value)) {
    return false;
  }

  try {
    const parsedUrl = new URL(value ?? "");

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidIsoDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.valueOf())) {
    return false;
  }

  return parsedDate.toISOString().slice(0, 10) === value;
}

function hasLocalizedText(value: { original?: string; zh?: string }): boolean {
  return hasText(value.original) || hasText(value.zh);
}

function hasDuplicateSlug(
  record: TechnologyWorkspaceRecord,
  workspaceRecords: TechnologyWorkspaceRecord[],
  publishedTechnologies: TechnologyItem[]
): boolean {
  const slug = record.slug.trim().toLowerCase();

  if (!slug) {
    return false;
  }

  return [
    ...publishedTechnologies.filter((item) => item.id !== record.id),
    ...workspaceRecords.filter((item) => item.id !== record.id)
  ].some((item) => item.slug.trim().toLowerCase() === slug);
}

function issue(
  severity: PublishReadinessSeverity,
  field: string,
  code: string,
  message: string
): PublishReadinessIssue {
  return { severity, field, code, message };
}

function isAllowed<T extends string>(
  value: string,
  allowedValues: readonly T[]
): boolean {
  return allowedValues.includes(value as T);
}

export function evaluateTechnologyPublishReadiness(
  record: TechnologyWorkspaceRecord,
  workspaceRecords: TechnologyWorkspaceRecord[],
  publishedTechnologies: TechnologyItem[] = technologyItems
): PublishReadinessResult {
  const blockingErrors: PublishReadinessIssue[] = [];
  const warnings: PublishReadinessIssue[] = [];

  if (!hasLocalizedText(record.title)) {
    blockingErrors.push(
      issue("blocking", "title", "missing-title", "Title is required.")
    );
  }

  if (!hasLocalizedText(record.summary)) {
    blockingErrors.push(
      issue("blocking", "summary", "missing-summary", "Summary is required.")
    );
  }

  if (!hasText(record.slug)) {
    blockingErrors.push(
      issue("blocking", "slug", "missing-slug", "Slug is required.")
    );
  } else if (
    hasDuplicateSlug(record, workspaceRecords, publishedTechnologies)
  ) {
    blockingErrors.push(
      issue(
        "blocking",
        "slug",
        "duplicate-slug",
        "Slug already exists on another technology record."
      )
    );
  }

  if (!hasText(record.sourceName)) {
    blockingErrors.push(
      issue(
        "blocking",
        "sourceName",
        "missing-source-name",
        "Source name is required."
      )
    );
  }

  if (!isValidHttpUrl(record.sourceUrl)) {
    blockingErrors.push(
      issue(
        "blocking",
        "sourceUrl",
        "invalid-source-url",
        "Source URL must be a valid http or https URL."
      )
    );
  }

  if (!isValidIsoDate(record.publishDate)) {
    blockingErrors.push(
      issue(
        "blocking",
        "publishDate",
        "invalid-publish-date",
        "Publish date must use YYYY-MM-DD format."
      )
    );
  }

  if (!hasLocalizedText(record.content)) {
    blockingErrors.push(
      issue(
        "blocking",
        "content",
        "missing-content",
        "Content must include original or Chinese text."
      )
    );
  }

  if (!isAllowed(record.type, technologyTypes)) {
    blockingErrors.push(
      issue("blocking", "type", "invalid-type", "Technology type is invalid.")
    );
  }

  if (!isAllowed(record.sourceLanguage, sourceLanguages)) {
    blockingErrors.push(
      issue(
        "blocking",
        "sourceLanguage",
        "invalid-source-language",
        "Source language is invalid."
      )
    );
  }

  if (!isAllowed(record.translationStatus, translationStatuses)) {
    blockingErrors.push(
      issue(
        "blocking",
        "translationStatus",
        "invalid-translation-status",
        "Translation status is invalid."
      )
    );
  }

  if (!isAllowed(record.publisherType, publisherTypes)) {
    blockingErrors.push(
      issue(
        "blocking",
        "publisherType",
        "invalid-publisher-type",
        "Publisher type is invalid."
      )
    );
  }

  if (!isAllowed(record.importanceLevel, importanceLevels)) {
    blockingErrors.push(
      issue(
        "blocking",
        "importanceLevel",
        "invalid-importance-level",
        "Importance level is invalid."
      )
    );
  }

  if (!isAllowed(record.status, technologyStatuses)) {
    blockingErrors.push(
      issue(
        "blocking",
        "status",
        "invalid-status",
        "Technology status is invalid."
      )
    );
  }

  if (
    record.sourceLanguage === "en" &&
    (!hasText(record.title.zh) || !hasText(record.summary.zh))
  ) {
    warnings.push(
      issue(
        "warning",
        "translation",
        "missing-chinese-title-summary",
        "English-source record does not have both Chinese title and summary."
      )
    );
  }

  if (record.tags.length < 2) {
    warnings.push(
      issue(
        "warning",
        "tags",
        "too-few-tags",
        "Add at least two tags to make the published item easier to browse."
      )
    );
  }

  if (record.relatedKnowledgeIds.length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedKnowledgeIds",
        "missing-related-knowledge",
        "No related knowledge item is linked yet."
      )
    );
  }

  if (record.relatedSkillIds.length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedSkillIds",
        "missing-related-skills",
        "No related skill is linked yet."
      )
    );
  }

  if (!hasText(record.publisherName)) {
    warnings.push(
      issue(
        "warning",
        "publisherName",
        "missing-publisher-name",
        "Publisher name is missing."
      )
    );
  }

  if (getLocalizedLength(record.summary) < 60) {
    warnings.push(
      issue(
        "warning",
        "summary",
        "short-summary",
        "Summary is short; consider adding more context before publishing."
      )
    );
  }

  if (getLocalizedLength(record.content) < 180) {
    warnings.push(
      issue(
        "warning",
        "content",
        "short-content",
        "Content is short; consider adding more explanation before publishing."
      )
    );
  }

  if (record.editorialNotes.length === 0) {
    warnings.push(
      issue(
        "warning",
        "editorialNotes",
        "missing-editorial-notes",
        "Editorial notes are empty."
      )
    );
  }

  const enrichmentReadiness = getEditorialEnrichmentReadinessState(record.id);

  if (!enrichmentReadiness.hasSuggestion) {
    warnings.push(
      issue(
        "warning",
        "editorialEnrichment",
        "missing-editorial-enrichment-suggestion",
        "No editorial enrichment suggestion has been generated; editors may miss an explanation-quality pass before publishing."
      )
    );
  } else if (enrichmentReadiness.hasUnreviewedSuggestion) {
    warnings.push(
      issue(
        "warning",
        "editorialEnrichment",
        "unreviewed-editorial-enrichment-suggestion",
        "An editorial enrichment suggestion exists but has not been applied or rejected yet."
      )
    );
  }

  if (!hasText(record.whyItMatters)) {
    warnings.push(
      issue(
        "warning",
        "whyItMatters",
        "missing-why-it-matters",
        "Why it matters is empty; this weakens user-facing understanding quality."
      )
    );
  }

  if ((record.whoShouldCare ?? []).length === 0) {
    warnings.push(
      issue(
        "warning",
        "whoShouldCare",
        "missing-who-should-care",
        "No target audience is listed; users may not know whether this signal matters to them."
      )
    );
  }

  if (Object.keys(record.relatedKnowledgeExplanations ?? {}).length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedKnowledgeExplanations",
        "missing-knowledge-explanations",
        "Related knowledge explanations are empty; the detail page will have less learning context."
      )
    );
  }

  if (Object.keys(record.relatedSkillExplanations ?? {}).length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedSkillExplanations",
        "missing-skill-explanations",
        "Related skill explanations are empty; the detail page will have less practical guidance."
      )
    );
  }

  if ((record.learningPath ?? []).length === 0) {
    warnings.push(
      issue(
        "warning",
        "learningPath",
        "missing-learning-path",
        "Learning path is empty; users will have less guidance on what to read next."
      )
    );
  }

  if ((record.followUpQuestions ?? []).length === 0) {
    warnings.push(
      issue(
        "warning",
        "followUpQuestions",
        "missing-follow-up-questions",
        "Follow-up questions are empty; users will have fewer prompts for deeper understanding."
      )
    );
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    warnings
  };
}
