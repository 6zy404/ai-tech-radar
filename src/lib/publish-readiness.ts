import { technologyItems } from "@/data/technologies";
import { getEditorialEnrichmentReadinessState } from "@/lib/editorial-enrichment-store";
import { getTechnologyTranslationCoverage } from "@/lib/technology-localization";
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
    super("技术工作台记录尚未达到发布条件。");
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
      issue("blocking", "title", "missing-title", "标题为必填项。")
    );
  }

  if (!hasLocalizedText(record.summary)) {
    blockingErrors.push(
      issue("blocking", "summary", "missing-summary", "摘要为必填项。")
    );
  }

  if (!hasText(record.slug)) {
    blockingErrors.push(
      issue("blocking", "slug", "missing-slug", "Slug 为必填项。")
    );
  } else if (
    hasDuplicateSlug(record, workspaceRecords, publishedTechnologies)
  ) {
    blockingErrors.push(
      issue(
        "blocking",
        "slug",
        "duplicate-slug",
        "Slug 已被另一条技术记录使用。"
      )
    );
  }

  if (!hasText(record.sourceName)) {
    blockingErrors.push(
      issue(
        "blocking",
        "sourceName",
        "missing-source-name",
        "来源名称为必填项。"
      )
    );
  }

  if (!isValidHttpUrl(record.sourceUrl)) {
    blockingErrors.push(
      issue(
        "blocking",
        "sourceUrl",
        "invalid-source-url",
        "来源 URL 必须是有效的 http 或 https 地址。"
      )
    );
  }

  if (!isValidIsoDate(record.publishDate)) {
    blockingErrors.push(
      issue(
        "blocking",
        "publishDate",
        "invalid-publish-date",
        "发布日期必须使用 YYYY-MM-DD 格式。"
      )
    );
  }

  if (!hasLocalizedText(record.content)) {
    blockingErrors.push(
      issue(
        "blocking",
        "content",
        "missing-content",
        "正文必须包含原文或中文内容。"
      )
    );
  }

  if (!isAllowed(record.type, technologyTypes)) {
    blockingErrors.push(
      issue("blocking", "type", "invalid-type", "技术类型无效。")
    );
  }

  if (!isAllowed(record.sourceLanguage, sourceLanguages)) {
    blockingErrors.push(
      issue(
        "blocking",
        "sourceLanguage",
        "invalid-source-language",
        "来源语言无效。"
      )
    );
  }

  if (!isAllowed(record.translationStatus, translationStatuses)) {
    blockingErrors.push(
      issue(
        "blocking",
        "translationStatus",
        "invalid-translation-status",
        "翻译状态无效。"
      )
    );
  }

  if (!isAllowed(record.publisherType, publisherTypes)) {
    blockingErrors.push(
      issue(
        "blocking",
        "publisherType",
        "invalid-publisher-type",
        "发布方类型无效。"
      )
    );
  }

  if (!isAllowed(record.importanceLevel, importanceLevels)) {
    blockingErrors.push(
      issue(
        "blocking",
        "importanceLevel",
        "invalid-importance-level",
        "重要程度无效。"
      )
    );
  }

  if (!isAllowed(record.status, technologyStatuses)) {
    blockingErrors.push(
      issue("blocking", "status", "invalid-status", "技术状态无效。")
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
        "英文来源记录还没有配齐中文标题和中文摘要。"
      )
    );
  }

  /* `translationStatus` is set by hand and nothing keeps it honest, so it
     drifts: 6 of 31 records said `pending` while fully translated in July,
     and 2 of 37 again in August — one of them published the day before.
     Compare it against the coverage derived from the content that is
     actually there, and say so when the two disagree. */
  const derivedCoverage = getTechnologyTranslationCoverage(record, "detail");

  if (derivedCoverage === "full" && record.translationStatus !== "done") {
    warnings.push(
      issue(
        "warning",
        "translationStatus",
        "translation-status-behind-content",
        `中文内容已齐全，但 translationStatus 仍是「${record.translationStatus}」；发布前请改为 done。`
      )
    );
  }

  if (derivedCoverage !== "full" && record.translationStatus === "done") {
    warnings.push(
      issue(
        "warning",
        "translationStatus",
        "translation-status-ahead-of-content",
        "translationStatus 标为 done，但正文的中文覆盖并不完整。"
      )
    );
  }

  /* Title and summary are rendered as plain strings everywhere — the hero, the
     list cards, the digest cards, `/network`, both feeds. Only `content` goes
     through `ContentBody`. So a `**bold**` written into a summary reaches
     readers as asterisks on every one of those surfaces at once.

     This has now happened twice: on 2026-08-12 in the vLLM v0.27.0 summary,
     and again on 2026-08-14 in two summaries of the same round — 36 marker
     occurrences across 9 public surfaces before it was caught by looking.
     Both times every structural check passed, because the markers are
     perfectly ordinary text. Checking here is what stops the third time. */
  for (const [field, value] of [
    ["title", record.title],
    ["summary", record.summary]
  ] as const) {
    const offending = Object.entries(value ?? {})
      .filter(
        ([, text]) =>
          typeof text === "string" &&
          (text.includes("**") ||
            /(^|\n)##\s/.test(text) ||
            /`[^`]+`/.test(text))
      )
      .map(([language]) => language);

    if (offending.length > 0) {
      warnings.push(
        issue(
          "warning",
          field,
          "markdown-markers-in-plain-text-field",
          `${field}.${offending.join("/")} 含 Markdown 标记，但该字段按纯文本渲染，标记会原样显示给读者。只有正文走 ContentBody。`
        )
      );
    }
  }

  /* The other half of the same problem, one level down. `content` does go
     through `ContentBody`, but its inline tokenizer is a flat alternation —
     `**bold**` OR `` `code` ``, never one inside the other — and the bold
     branch takes its inner text verbatim. So ``**`reasoning_effort`**`` renders
     bold with the backticks still showing.

     Found 2026-08-16 by looking at a page: 5 occurrences across 3 published
     signals, two of them written that same round. It is the 2026-08-02 defect
     (backticks reaching readers) in the shape inline code did not fix. */
  for (const [language, text] of Object.entries(record.content ?? {})) {
    if (typeof text !== "string") continue;

    const nested = text
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
      .filter(Boolean)
      .some(
        (part) =>
          (part.length > 4 &&
            part.startsWith("**") &&
            part.endsWith("**") &&
            part.includes("`")) ||
          (part.length > 2 &&
            part.startsWith("`") &&
            part.endsWith("`") &&
            part.includes("**"))
      );

    if (nested) {
      warnings.push(
        issue(
          "warning",
          "content",
          "nested-inline-markers-in-body",
          `content.${language} 把行内代码写进了加粗（或反过来）。ContentBody 不解析嵌套的行内标记，内层的反引号或星号会原样显示给读者——把两者并列而不是嵌套。`
        )
      );
    }
  }

  if (record.tags.length < 2) {
    warnings.push(
      issue(
        "warning",
        "tags",
        "too-few-tags",
        "建议至少添加两个标签，让发布内容更易浏览。"
      )
    );
  }

  if (record.relatedKnowledgeIds.length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedKnowledgeIds",
        "missing-related-knowledge",
        "尚未关联任何背景知识。"
      )
    );
  }

  if (record.relatedSkillIds.length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedSkillIds",
        "missing-related-skills",
        "尚未关联任何技能。"
      )
    );
  }

  if (!hasText(record.publisherName)) {
    warnings.push(
      issue(
        "warning",
        "publisherName",
        "missing-publisher-name",
        "缺少发布方名称。"
      )
    );
  }

  if (getLocalizedLength(record.summary) < 60) {
    warnings.push(
      issue(
        "warning",
        "summary",
        "short-summary",
        "摘要偏短；建议在发布前补充更多背景。"
      )
    );
  }

  if (getLocalizedLength(record.content) < 180) {
    warnings.push(
      issue(
        "warning",
        "content",
        "short-content",
        "正文偏短；建议在发布前补充更多解释。"
      )
    );
  }

  if (record.editorialNotes.length === 0) {
    warnings.push(
      issue(
        "warning",
        "editorialNotes",
        "missing-editorial-notes",
        "编辑备注为空。"
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
        "尚未生成富化建议；编辑可能会错过发布前的解释质量检查。"
      )
    );
  } else if (enrichmentReadiness.hasUnreviewedSuggestion) {
    warnings.push(
      issue(
        "warning",
        "editorialEnrichment",
        "unreviewed-editorial-enrichment-suggestion",
        "已存在富化建议，但尚未应用或拒绝。"
      )
    );
  }

  if (!hasText(record.whyItMatters)) {
    warnings.push(
      issue(
        "warning",
        "whyItMatters",
        "missing-why-it-matters",
        "「为什么重要」为空；会削弱用户端的理解质量。"
      )
    );
  }

  if ((record.whoShouldCare ?? []).length === 0) {
    warnings.push(
      issue(
        "warning",
        "whoShouldCare",
        "missing-who-should-care",
        "未列出目标人群；用户可能无法判断这条信号与自己是否相关。"
      )
    );
  }

  if (Object.keys(record.relatedKnowledgeExplanations ?? {}).length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedKnowledgeExplanations",
        "missing-knowledge-explanations",
        "知识关联说明为空；详情页的学习背景会变少。"
      )
    );
  }

  if (Object.keys(record.relatedSkillExplanations ?? {}).length === 0) {
    warnings.push(
      issue(
        "warning",
        "relatedSkillExplanations",
        "missing-skill-explanations",
        "技能关联说明为空；详情页的实践指引会变少。"
      )
    );
  }

  if ((record.learningPath ?? []).length === 0) {
    warnings.push(
      issue(
        "warning",
        "learningPath",
        "missing-learning-path",
        "学习路径为空；用户将缺少下一步阅读指引。"
      )
    );
  }

  if ((record.followUpQuestions ?? []).length === 0) {
    warnings.push(
      issue(
        "warning",
        "followUpQuestions",
        "missing-follow-up-questions",
        "后续问题为空；用户深入理解的线索会变少。"
      )
    );
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    warnings
  };
}
