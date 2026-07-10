import { getCandidateWorkflowData } from "@/lib/candidate-workflow";
import {
  getImportedCandidateSourceId,
  mergeImportedCandidatesForSource
} from "@/lib/candidate-import-snapshot-store";
import { normalizeCandidateId, normalizeCandidateTags } from "@/lib/importers";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  CandidateNormalizedType,
  ExternalSource,
  ExternalSourceImportStatus,
  ExternalSourceType,
  ImportRun,
  ImportedCandidate,
  ImportedCandidateSourceRecord,
  ImportedSourceType,
  PublisherType,
  SourceLanguage
} from "@/types/content";

interface ExternalSourceStore {
  updatedAt: string;
  sources: ExternalSource[];
  latestImportRun?: ImportRun;
  importRuns?: ImportRun[];
}

export interface ExternalSourceInput {
  name: string;
  type: ExternalSourceType;
  url: string;
  enabled: boolean;
  description?: string;
  language: SourceLanguage;
  publisherName?: string;
  publisherType: PublisherType;
  defaultTags: string[];
  defaultNormalizedType: CandidateNormalizedType;
}

export interface ExternalSourceImportResult {
  source: ExternalSource;
  candidates: ImportedCandidate[];
  status: ExternalSourceImportStatus;
  message: string;
  candidatesCreated: number;
  candidatesSkipped: number;
  importedAt: string;
  importRunId?: string;
}

export interface ExternalSourceBatchImportResult {
  run: ImportRun;
  results: ExternalSourceImportResult[];
}

export function coerceExternalSourceInput(
  value: Record<string, unknown>
): ExternalSourceInput {
  const rawTags = value.defaultTags;
  const defaultTags = Array.isArray(rawTags)
    ? rawTags.map((item) => String(item))
    : typeof rawTags === "string"
      ? rawTags.split(",").map((item) => item.trim())
      : [];

  return {
    name: String(value.name ?? ""),
    type: String(value.type ?? "rss") as ExternalSourceType,
    url: String(value.url ?? ""),
    enabled: Boolean(value.enabled),
    description:
      typeof value.description === "string" ? value.description : undefined,
    language: String(value.language ?? "en") as SourceLanguage,
    publisherName:
      typeof value.publisherName === "string" ? value.publisherName : undefined,
    publisherType: String(value.publisherType ?? "media") as PublisherType,
    defaultTags,
    defaultNormalizedType: String(
      value.defaultNormalizedType ?? "unknown"
    ) as CandidateNormalizedType
  };
}

export class ExternalSourceValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues.join(" "));
    this.name = "ExternalSourceValidationError";
    this.issues = issues;
  }
}

const externalSourcesStorePath = getLocalStoreFilePath("external-sources.json");
const allowedSourceTypes: ExternalSourceType[] = [
  "rss",
  "atom",
  "github_release",
  "official_blog"
];
const allowedLanguages: SourceLanguage[] = ["en", "zh"];
const allowedPublisherTypes: PublisherType[] = [
  "big-tech",
  "startup",
  "research-lab",
  "open-source-community",
  "media"
];
const allowedNormalizedTypes: CandidateNormalizedType[] = [
  "platform",
  "tool",
  "model",
  "protocol",
  "workflow",
  "unknown"
];

function nowIso(): string {
  return new Date().toISOString();
}

function initialHealthFields() {
  return {
    lastImportStatus: "never_run" as const,
    lastImportCount: 0,
    consecutiveFailureCount: 0,
    totalImportedCount: 0
  };
}

function defaultExternalSources(): ExternalSource[] {
  const createdAt = nowIso();

  return [
    {
      id: "openai-news-rss",
      name: "OpenAI News RSS",
      type: "rss",
      url: "https://openai.com/news/rss.xml",
      enabled: true,
      description:
        "Official OpenAI news RSS feed for product and research updates.",
      language: "en",
      publisherName: "OpenAI",
      publisherType: "big-tech",
      defaultTags: ["agents", "workflow"],
      defaultNormalizedType: "unknown",
      ...initialHealthFields(),
      createdAt,
      updatedAt: createdAt,
      maxItems: 4
    },
    {
      id: "mcp-github-releases-atom",
      name: "MCP TypeScript SDK Releases Atom",
      type: "atom",
      url: "https://github.com/modelcontextprotocol/typescript-sdk/releases.atom",
      enabled: true,
      description:
        "GitHub release Atom feed for the Model Context Protocol TypeScript SDK.",
      language: "en",
      publisherName: "modelcontextprotocol",
      publisherType: "open-source-community",
      defaultTags: ["protocol", "sdk"],
      defaultNormalizedType: "tool",
      ...initialHealthFields(),
      createdAt,
      updatedAt: createdAt,
      maxItems: 4
    },
    {
      id: "mcp-github-releases-api",
      name: "MCP TypeScript SDK Releases API",
      type: "github_release",
      url: "https://api.github.com/repos/modelcontextprotocol/typescript-sdk/releases",
      enabled: true,
      description:
        "GitHub Releases API source for structured release payloads.",
      language: "en",
      publisherName: "modelcontextprotocol",
      publisherType: "open-source-community",
      defaultTags: ["protocol", "sdk", "github"],
      defaultNormalizedType: "tool",
      ...initialHealthFields(),
      createdAt,
      updatedAt: createdAt,
      maxItems: 4
    },
    {
      id: "anthropic-news-pages",
      name: "Anthropic News",
      type: "official_blog",
      url: "https://www.anthropic.com/news",
      enabled: true,
      description:
        "Official Anthropic news pages used as a lightweight official-blog source.",
      language: "en",
      publisherName: "Anthropic",
      publisherType: "research-lab",
      defaultTags: ["agents", "workflow"],
      defaultNormalizedType: "unknown",
      ...initialHealthFields(),
      createdAt,
      updatedAt: createdAt,
      maxItems: 2
    }
  ];
}

function normalizeUrl(value: string): string {
  try {
    const parsedUrl = new URL(value);

    parsedUrl.hash = "";

    return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function mapSourceTypeToImportedSourceType(
  sourceType: ExternalSourceType
): ImportedSourceType {
  if (sourceType === "github_release") {
    return "github-release";
  }

  if (sourceType === "official_blog") {
    return "official-blog";
  }

  return "rss-feed";
}

function buildSourceRecordForSource(
  source: ExternalSource,
  itemCount: number,
  syncStatus: ImportedCandidateSourceRecord["syncStatus"],
  note?: string
): ImportedCandidateSourceRecord {
  return {
    id: source.id,
    sourceType: mapSourceTypeToImportedSourceType(source.type),
    sourceName: source.name,
    sourceUrl: source.url,
    syncStatus,
    itemCount,
    fetchedAt: nowIso(),
    note
  };
}

function sanitizeSource(source: ExternalSource): ExternalSource {
  const lastImportStatus = source.lastImportStatus ?? "never_run";

  return {
    ...source,
    name: source.name.trim(),
    url: source.url.trim(),
    enabled: Boolean(source.enabled),
    description: normalizeOptionalText(source.description),
    publisherName: normalizeOptionalText(source.publisherName),
    defaultTags: normalizeCandidateTags(source.defaultTags ?? []),
    lastImportStatus,
    lastImportCount: source.lastImportCount ?? 0,
    lastErrorMessage:
      lastImportStatus === "failed" || lastImportStatus === "partial"
        ? normalizeOptionalText(
            source.lastErrorMessage ?? source.lastImportMessage
          )
        : undefined,
    consecutiveFailureCount: source.consecutiveFailureCount ?? 0,
    totalImportedCount: source.totalImportedCount ?? 0,
    createdAt: source.createdAt ?? nowIso(),
    updatedAt: source.updatedAt ?? nowIso()
  };
}

function readStore(): ExternalSourceStore {
  const store = readJsonFile<ExternalSourceStore>(externalSourcesStorePath, {
    updatedAt: nowIso(),
    sources: defaultExternalSources()
  });

  return {
    updatedAt: store.updatedAt ?? nowIso(),
    sources: (store.sources ?? []).map(sanitizeSource),
    latestImportRun: store.latestImportRun,
    importRuns: store.importRuns ?? []
  };
}

function writeStore(store: ExternalSourceStore) {
  writeJsonFile(externalSourcesStorePath, {
    updatedAt: nowIso(),
    sources: store.sources.map(sanitizeSource),
    latestImportRun: store.latestImportRun,
    importRuns: (store.importRuns ?? []).slice(0, 20)
  });
}

function validateSourceInput(
  input: ExternalSourceInput,
  existingSources: ExternalSource[],
  currentId?: string
) {
  const issues: string[] = [];
  const name = input.name.trim();
  const url = input.url.trim();

  if (!name) {
    issues.push("来源名称为必填项。");
  }

  if (!allowedSourceTypes.includes(input.type)) {
    issues.push("不支持该来源类型。");
  }

  if (!url) {
    issues.push("来源 URL 为必填项。");
  } else if (!isValidHttpUrl(url)) {
    issues.push("来源 URL 必须是有效的 http 或 https 地址。");
  }

  if (!allowedLanguages.includes(input.language)) {
    issues.push("不支持该来源语言。");
  }

  if (!allowedPublisherTypes.includes(input.publisherType)) {
    issues.push("不支持该发布方类型。");
  }

  if (!allowedNormalizedTypes.includes(input.defaultNormalizedType)) {
    issues.push("不支持该默认内容类型。");
  }

  const normalizedUrl = normalizeUrl(url);
  const hasDuplicateUrl = existingSources.some(
    (source) =>
      source.id !== currentId && normalizeUrl(source.url) === normalizedUrl
  );

  if (hasDuplicateUrl) {
    issues.push("A source with the same URL already exists.");
  }

  if (issues.length > 0) {
    throw new ExternalSourceValidationError(issues);
  }
}

function buildSourceFromInput(
  input: ExternalSourceInput,
  existingSources: ExternalSource[]
): ExternalSource {
  const createdAt = nowIso();
  const baseId = `source-${normalizeCandidateId(input.name || input.url) || "external"}`;
  let id = baseId;
  let suffix = 2;

  while (existingSources.some((source) => source.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id,
    name: input.name.trim(),
    type: input.type,
    url: input.url.trim(),
    enabled: Boolean(input.enabled),
    description: normalizeOptionalText(input.description),
    language: input.language,
    publisherName: normalizeOptionalText(input.publisherName),
    publisherType: input.publisherType,
    defaultTags: normalizeCandidateTags(input.defaultTags),
    defaultNormalizedType: input.defaultNormalizedType,
    ...initialHealthFields(),
    createdAt,
    updatedAt: createdAt,
    maxItems: 4
  };
}

function buildFallbackCandidatesForSource(
  source: ExternalSource,
  reason: string
): ImportedCandidate[] {
  const date = new Date().toISOString().slice(0, 10);
  const normalizedTitle = `${source.name} fallback import ${date}`;

  return [
    {
      id: `candidate-source-${normalizeCandidateId(`${source.id}-${date}`)}`,
      sourceId: source.id,
      sourceType: mapSourceTypeToImportedSourceType(source.type),
      sourceName: source.name,
      sourceUrl: source.url,
      originalTitle: normalizedTitle,
      originalSummary:
        "实时来源不可用时生成的本地回退候选，用于检查来源导入工作流。",
      originalContent:
        "本次本地运行未能导入实时外部来源。这条回退候选保留了来源配置、导入尝试与溯源字段，便于审核者继续验证「来源 → 候选」工作流。",
      originalLanguage: source.language,
      publishDate: date,
      publisherName: source.publisherName ?? source.name,
      normalizedType: source.defaultNormalizedType,
      tags: normalizeCandidateTags([...source.defaultTags, "fallback"]),
      importStatus: "new",
      relatedCandidateIds: [],
      rawPayload: {
        sourceId: source.id,
        fallback: true,
        fallbackReason: reason,
        source
      }
    }
  ];
}

function getCandidateDedupKey(candidate: ImportedCandidate): string {
  return normalizeUrl(candidate.sourceUrl || candidate.id);
}

function prepareImportedCandidates(
  source: ExternalSource,
  importedCandidates: ImportedCandidate[],
  importedAt: string,
  importRunId?: string
): {
  candidates: ImportedCandidate[];
  candidatesCreated: number;
  candidatesSkipped: number;
} {
  const existingCandidates = getCandidateWorkflowData().snapshot.candidates;
  const existingCurrentSourceKeys = new Set<string>();
  const existingCurrentSourceIds = new Set<string>();
  const existingOtherSourceKeys = new Set<string>();
  const existingOtherSourceIds = new Set<string>();

  for (const candidate of existingCandidates) {
    const candidateSourceId = getImportedCandidateSourceId(candidate);

    if (candidateSourceId === source.id) {
      existingCurrentSourceIds.add(candidate.id);
      existingCurrentSourceKeys.add(getCandidateDedupKey(candidate));
      continue;
    }

    existingOtherSourceIds.add(candidate.id);
    existingOtherSourceKeys.add(getCandidateDedupKey(candidate));
  }

  let candidatesCreated = 0;
  let candidatesSkipped = 0;
  const candidates: ImportedCandidate[] = [];
  const seenKeysInRun = new Set<string>();
  const seenIdsInRun = new Set<string>();

  for (const candidate of importedCandidates) {
    const dedupKey = getCandidateDedupKey(candidate);
    const isDuplicateInRun =
      seenIdsInRun.has(candidate.id) || seenKeysInRun.has(dedupKey);
    const isDuplicateFromOtherSource =
      existingOtherSourceIds.has(candidate.id) ||
      existingOtherSourceKeys.has(dedupKey);
    const isExistingCurrentSource =
      existingCurrentSourceIds.has(candidate.id) ||
      existingCurrentSourceKeys.has(dedupKey);

    if (isDuplicateInRun || isDuplicateFromOtherSource) {
      candidatesSkipped += 1;
      continue;
    }

    if (isExistingCurrentSource) {
      candidatesSkipped += 1;
    } else {
      candidatesCreated += 1;
    }

    seenIdsInRun.add(candidate.id);
    seenKeysInRun.add(dedupKey);
    candidates.push({
      ...candidate,
      sourceId: source.id,
      importedAt,
      importRunId,
      rawPayload:
        candidate.rawPayload && typeof candidate.rawPayload === "object"
          ? {
              ...(candidate.rawPayload as Record<string, unknown>),
              sourceId: source.id,
              importedAt,
              importRunId
            }
          : {
              rawPayload: candidate.rawPayload,
              sourceId: source.id,
              importedAt,
              importRunId
            }
    });
  }

  return { candidates, candidatesCreated, candidatesSkipped };
}

function updateSourceImportState(
  sourceId: string,
  status: ExternalSourceImportStatus,
  message: string,
  importCount: number,
  candidatesCreated: number
): ExternalSource {
  const store = readStore();
  const source = store.sources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`未找到外部来源 ${sourceId}。`);
  }

  const nextSource: ExternalSource = {
    ...source,
    lastFetchedAt: nowIso(),
    lastImportStatus: status,
    lastImportMessage: message,
    lastImportCount: importCount,
    lastErrorMessage:
      status === "failed" || status === "partial" ? message : undefined,
    consecutiveFailureCount:
      status === "success" ? 0 : (source.consecutiveFailureCount ?? 0) + 1,
    totalImportedCount: (source.totalImportedCount ?? 0) + candidatesCreated,
    lastSuccessfulImportAt:
      status === "success" ? nowIso() : source.lastSuccessfulImportAt,
    updatedAt: nowIso()
  };

  writeStore({
    updatedAt: nowIso(),
    sources: store.sources.map((item) =>
      item.id === sourceId ? nextSource : item
    )
  });

  tryRecordWorkflowEvent({
    entityType: "source",
    entityId: sourceId,
    action: "source.imported",
    actorType: "workspace_user",
    beforeSnapshot: source,
    afterSnapshot: nextSource,
    metadata: {
      status,
      message,
      importCount,
      candidatesCreated
    }
  });

  return nextSource;
}

export function getExternalSources(): ExternalSource[] {
  return readStore().sources.sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export function getExternalSourceById(id: string): ExternalSource | undefined {
  return getExternalSources().find((source) => source.id === id);
}

export function createExternalSource(
  input: ExternalSourceInput
): ExternalSource {
  const store = readStore();

  validateSourceInput(input, store.sources);

  const source = buildSourceFromInput(input, store.sources);

  writeStore({
    updatedAt: nowIso(),
    sources: [...store.sources, source]
  });

  return source;
}

export function updateExternalSource(
  sourceId: string,
  input: ExternalSourceInput
): ExternalSource {
  const store = readStore();
  const existingSource = store.sources.find((source) => source.id === sourceId);

  if (!existingSource) {
    throw new Error(`未找到外部来源 ${sourceId}。`);
  }

  validateSourceInput(input, store.sources, sourceId);

  const nextSource: ExternalSource = {
    ...existingSource,
    name: input.name.trim(),
    type: input.type,
    url: input.url.trim(),
    enabled: Boolean(input.enabled),
    description: normalizeOptionalText(input.description),
    language: input.language,
    publisherName: normalizeOptionalText(input.publisherName),
    publisherType: input.publisherType,
    defaultTags: normalizeCandidateTags(input.defaultTags),
    defaultNormalizedType: input.defaultNormalizedType,
    updatedAt: nowIso()
  };

  writeStore({
    updatedAt: nowIso(),
    sources: store.sources.map((source) =>
      source.id === sourceId ? nextSource : source
    )
  });

  return nextSource;
}

export function setExternalSourceEnabled(
  sourceId: string,
  enabled: boolean
): ExternalSource {
  const store = readStore();
  const existingSource = store.sources.find((source) => source.id === sourceId);

  if (!existingSource) {
    throw new Error(`未找到外部来源 ${sourceId}。`);
  }

  const nextSource: ExternalSource = {
    ...existingSource,
    enabled,
    updatedAt: nowIso()
  };

  writeStore({
    updatedAt: nowIso(),
    sources: store.sources.map((source) =>
      source.id === sourceId ? nextSource : source
    )
  });

  return nextSource;
}

export function getImportedCandidatesForExternalSource(
  sourceId: string
): ImportedCandidate[] {
  return getCandidateWorkflowData().candidates.filter(
    (candidate) => getImportedCandidateSourceId(candidate) === sourceId
  );
}

export function getLatestExternalSourceImportRun(): ImportRun | undefined {
  return readStore().latestImportRun;
}

export function getExternalSourceImportRuns(): ImportRun[] {
  return readStore().importRuns ?? [];
}

function buildImportRunId(startedAt: string): string {
  return `import-run-${startedAt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function persistImportRun(run: ImportRun) {
  const store = readStore();
  const importRuns = [run, ...(store.importRuns ?? [])].slice(0, 20);

  writeStore({
    ...store,
    updatedAt: nowIso(),
    latestImportRun: run,
    importRuns
  });
}

export async function runImportForSource(
  sourceId: string,
  options: { useFallbackOnFailure?: boolean; importRunId?: string } = {}
): Promise<ExternalSourceImportResult> {
  const source = getExternalSourceById(sourceId);
  const useFallbackOnFailure = options.useFallbackOnFailure ?? true;
  const importedAt = nowIso();

  if (!source) {
    throw new Error(`未找到外部来源 ${sourceId}。`);
  }

  if (!source.enabled) {
    const updatedSource = updateSourceImportState(
      source.id,
      "failed",
      "来源已停用。导入前请先启用。",
      0,
      0
    );

    return {
      source: updatedSource,
      candidates: [],
      status: "failed",
      message: updatedSource.lastImportMessage ?? "来源已停用。",
      candidatesCreated: 0,
      candidatesSkipped: 0,
      importedAt,
      importRunId: options.importRunId
    };
  }

  try {
    const { importCandidatesForExternalSource } =
      await import("@/lib/external-import");
    const importedCandidates = await importCandidatesForExternalSource(source);

    if (importedCandidates.length === 0) {
      throw new Error("来源没有返回任何候选记录。");
    }

    const { candidates, candidatesCreated, candidatesSkipped } =
      prepareImportedCandidates(
        source,
        importedCandidates,
        importedAt,
        options.importRunId
      );
    const sourceRecord = buildSourceRecordForSource(
      source,
      candidates.length,
      "live"
    );

    mergeImportedCandidatesForSource(sourceRecord, candidates);

    const updatedSource = updateSourceImportState(
      source.id,
      "success",
      `导入 ${candidatesCreated} 条新候选；跳过 ${candidatesSkipped} 条重复或已存在的候选。`,
      candidates.length,
      candidatesCreated
    );

    return {
      source: updatedSource,
      candidates,
      status: "success",
      message: updatedSource.lastImportMessage ?? "导入完成。",
      candidatesCreated,
      candidatesSkipped,
      importedAt,
      importRunId: options.importRunId
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知的来源导入错误。";

    if (useFallbackOnFailure) {
      const importedCandidates = buildFallbackCandidatesForSource(
        source,
        message
      );
      const {
        candidates: fallbackCandidates,
        candidatesCreated,
        candidatesSkipped
      } = prepareImportedCandidates(
        source,
        importedCandidates,
        importedAt,
        options.importRunId
      );
      const sourceRecord = buildSourceRecordForSource(
        source,
        fallbackCandidates.length,
        "fallback",
        `实时导入失败；已使用本地回退。${message}`
      );

      mergeImportedCandidatesForSource(sourceRecord, fallbackCandidates);

      const updatedSource = updateSourceImportState(
        source.id,
        "partial",
        `实时导入失败；已使用本地回退。${message}`,
        fallbackCandidates.length,
        candidatesCreated
      );

      return {
        source: updatedSource,
        candidates: fallbackCandidates,
        status: "partial",
        message: updatedSource.lastImportMessage ?? message,
        candidatesCreated,
        candidatesSkipped,
        importedAt,
        importRunId: options.importRunId
      };
    }

    const updatedSource = updateSourceImportState(
      source.id,
      "failed",
      message,
      0,
      0
    );

    return {
      source: updatedSource,
      candidates: [],
      status: "failed",
      message,
      candidatesCreated: 0,
      candidatesSkipped: 0,
      importedAt,
      importRunId: options.importRunId
    };
  }
}

export async function runBatchImportForEnabledSources(
  options: { useFallbackOnFailure?: boolean } = {}
): Promise<ExternalSourceBatchImportResult> {
  const startedAt = nowIso();
  const importRunId = buildImportRunId(startedAt);
  const allSources = getExternalSources();
  const enabledSources = allSources.filter((source) => source.enabled);
  const results: ExternalSourceImportResult[] = [];

  for (const source of enabledSources) {
    try {
      results.push(
        await runImportForSource(source.id, {
          ...options,
          importRunId
        })
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知的来源导入错误。";
      const updatedSource = updateSourceImportState(
        source.id,
        "failed",
        message,
        0,
        0
      );

      results.push({
        source: updatedSource,
        candidates: [],
        status: "failed",
        message,
        candidatesCreated: 0,
        candidatesSkipped: 0,
        importedAt: nowIso(),
        importRunId
      });
    }
  }

  const successfulSources = results.filter(
    (result) => result.status === "success"
  ).length;
  const failedSources = results.filter(
    (result) => result.status === "failed"
  ).length;
  const partialSources = results.filter(
    (result) => result.status === "partial"
  ).length;
  const status =
    failedSources === 0 && partialSources === 0
      ? "success"
      : successfulSources === 0 && partialSources === 0
        ? "failed"
        : "partial";
  const run: ImportRun = {
    id: importRunId,
    startedAt,
    finishedAt: nowIso(),
    status,
    totalSources: allSources.length,
    enabledSources: enabledSources.length,
    skippedSources: allSources.length - enabledSources.length,
    successfulSources,
    failedSources,
    partialSources,
    totalCandidatesCreated: results.reduce(
      (count, result) => count + result.candidatesCreated,
      0
    ),
    totalCandidatesSkipped: results.reduce(
      (count, result) => count + result.candidatesSkipped,
      0
    ),
    messages: results.map(
      (result) => `${result.source.name}: ${result.message}`
    ),
    sourceResults: results.map((result) => ({
      sourceId: result.source.id,
      sourceName: result.source.name,
      status: result.status,
      message: result.message,
      candidateCount: result.candidates.length,
      candidatesCreated: result.candidatesCreated,
      candidatesSkipped: result.candidatesSkipped
    }))
  };

  persistImportRun(run);

  return { run, results };
}

export async function runImportForEnabledSources(
  options: { useFallbackOnFailure?: boolean } = {}
): Promise<ExternalSourceImportResult[]> {
  const batchResult = await runBatchImportForEnabledSources(options);

  return batchResult.results;
}
