import {
  calculateTokenSimilarity,
  normalizeUrlForComparison
} from "@/lib/candidate-duplicate-rules";
import type {
  CandidateQualityFlag,
  CandidateQualitySignals,
  ExternalSource,
  ImportRun,
  ImportedCandidate,
  SourceQualityLevel,
  SourceQualityMetrics
} from "@/types/content";

// A candidate is compared against these to decide whether the same
// announcement has already been published. Only the fields the comparison
// needs, so callers do not have to hand over whole workspace records.
export interface PublishedSignalFingerprint {
  id: string;
  sourceUrl: string;
  titles: string[];
}

interface CandidateQualityOptions {
  canConvert?: boolean;
  publishedSignals?: PublishedSignalFingerprint[];
}

export function buildPublishedSignalFingerprints(
  technologies: {
    id: string;
    sourceUrl: string;
    title: { original: string; zh?: string; en?: string };
  }[]
): PublishedSignalFingerprint[] {
  return technologies.map((technology) => ({
    id: technology.id,
    sourceUrl: technology.sourceUrl,
    titles: [
      technology.title.original,
      technology.title.zh,
      technology.title.en
    ].filter((title): title is string => Boolean(title?.trim()))
  }));
}

// Measured against the real pool on 2026-07-28: genuine re-publications of an
// already-published announcement score 0.8 and 1.0, while the next-highest
// unrelated candidate scores 0.3, so the threshold sits inside a wide gap
// rather than on a guess.
const ALREADY_PUBLISHED_TITLE_SIMILARITY = 0.8;

function isAlreadyPublishedSignal(
  candidate: ImportedCandidate,
  publishedSignals: PublishedSignalFingerprint[]
): boolean {
  const candidateUrl = normalizeUrlForComparison(candidate.sourceUrl ?? "");

  return publishedSignals.some((signal) => {
    // A converted candidate always matches the signal it produced; that is
    // traceability, not a duplicate.
    if (signal.id === candidate.convertedTechnologyId) {
      return false;
    }

    if (
      candidateUrl.length > 0 &&
      normalizeUrlForComparison(signal.sourceUrl) === candidateUrl
    ) {
      return true;
    }

    return signal.titles.some(
      (title) =>
        calculateTokenSimilarity(candidate.originalTitle, title) >=
        ALREADY_PUBLISHED_TITLE_SIMILARITY
    );
  });
}

function isPresent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDate(value: string | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isCandidateDuplicate(candidate: ImportedCandidate): boolean {
  return (
    Boolean(candidate.duplicateGroupId) ||
    candidate.relatedCandidateIds.length > 0
  );
}

function isCandidateTooShort(candidate: ImportedCandidate): boolean {
  const summaryLength = candidate.originalSummary?.trim().length ?? 0;
  const contentLength = candidate.originalContent?.trim().length ?? 0;

  return (
    (summaryLength > 0 && summaryLength < 60) ||
    (contentLength > 0 && contentLength < 160)
  );
}

/**
 * Release-candidate / pre-release version tags (`v1.2.3-rc0`, `-alpha.1`,
 * `-beta`, `-preview`). Release feeds publish these alongside — and usually
 * days before — the matching stable tag, and every editorial round so far has
 * rejected them by hand: 4 of the 16 undecided candidates on 2026-07-27, and
 * at least one in each of the three rounds before it. Flagging them keeps the
 * judgment with the editor while making the batch obvious at a glance.
 */
function isPrereleaseVersion(candidate: ImportedCandidate): boolean {
  const title = candidate.originalTitle?.trim() ?? "";

  // The marker must sit on a version-looking token (`v0.26.0rc1`,
  // `v0.32.5-rc0`, `v1.0.0-beta.2`). Matching a bare keyword would flag prose
  // titles such as "Preview: ..." or "Dev tools ...", and release feeds glue
  // the marker straight onto the digits often enough that a leading separator
  // cannot be required either.
  return /\bv?\d+(?:\.\d+)+[.\-_]?(?:rc|alpha|beta|preview|dev|nightly)[.\-_]?\d*\b/i.test(
    title
  );
}

function hasCandidatePublisher(candidate: ImportedCandidate): boolean {
  if (!isPresent(candidate.publisherName)) {
    return false;
  }

  const rawPayload = candidate.rawPayload;

  if (!rawPayload || typeof rawPayload !== "object") {
    return true;
  }

  const record = rawPayload as Record<string, unknown>;
  const rawPublisher =
    record.publisherName ?? record.publisher ?? record.author ?? record.creator;

  return !(typeof rawPublisher === "string" && rawPublisher.trim() === "");
}

function getCandidateSourceId(
  candidate: ImportedCandidate
): string | undefined {
  if (candidate.sourceId) {
    return candidate.sourceId;
  }

  const rawPayload = candidate.rawPayload;

  if (
    rawPayload &&
    typeof rawPayload === "object" &&
    "sourceId" in rawPayload
  ) {
    const sourceId = (rawPayload as { sourceId?: unknown }).sourceId;

    return typeof sourceId === "string" ? sourceId : undefined;
  }

  return undefined;
}

function calculateRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(2));
}

function inferSourceQualityLevel(
  source: ExternalSource,
  metrics: Omit<SourceQualityMetrics, "qualityLevel">
): SourceQualityLevel {
  if (metrics.totalImportRuns === 0 && metrics.totalCandidatesImported === 0) {
    return "unknown";
  }

  if (
    metrics.consecutiveFailureCount >= 2 ||
    metrics.successRate < 0.5 ||
    metrics.rejectionRate >= 0.6
  ) {
    return "poor";
  }

  if (
    source.lastImportStatus === "failed" ||
    source.lastImportStatus === "partial" ||
    metrics.successRate < 0.8 ||
    metrics.duplicateRate >= 0.5 ||
    metrics.rejectionRate >= 0.35
  ) {
    return "watch";
  }

  return "good";
}

export function evaluateCandidateQuality(
  candidate: ImportedCandidate,
  options: CandidateQualityOptions = {}
): CandidateQualitySignals {
  const hasTitle = isPresent(candidate.originalTitle);
  const hasSummary = isPresent(candidate.originalSummary);
  const hasContent = isPresent(candidate.originalContent);
  const hasSourceUrl = isValidHttpUrl(candidate.sourceUrl);
  const hasPublisher = hasCandidatePublisher(candidate);
  const hasValidPublishDate = isValidDate(candidate.publishDate);
  const hasTags = candidate.tags.length > 0;
  const isDuplicate = isCandidateDuplicate(candidate);
  const isTooShort = isCandidateTooShort(candidate);
  const isPrerelease = isPrereleaseVersion(candidate);
  const isAlreadyPublished = isAlreadyPublishedSignal(
    candidate,
    options.publishedSignals ?? []
  );
  const isConvertible =
    Boolean(options.canConvert) &&
    hasTitle &&
    hasSummary &&
    hasContent &&
    hasSourceUrl &&
    hasPublisher &&
    hasValidPublishDate &&
    hasTags &&
    !isTooShort &&
    candidate.importStatus !== "converted" &&
    candidate.importStatus !== "rejected";
  const flags: CandidateQualityFlag[] = [];

  if (!hasSummary) {
    flags.push("missing_summary");
  }

  if (!hasContent) {
    flags.push("missing_content");
  }

  if (!hasPublisher) {
    flags.push("missing_publisher");
  }

  if (!hasSourceUrl) {
    flags.push("invalid_source_url");
  }

  if (!hasValidPublishDate) {
    flags.push("invalid_publish_date");
  }

  if (!hasTags) {
    flags.push("missing_tags");
  }

  if (isDuplicate) {
    flags.push("possible_duplicate");
  }

  if (isTooShort) {
    flags.push("too_short");
  }

  if (isPrerelease) {
    flags.push("prerelease_version");
  }

  if (isAlreadyPublished) {
    flags.push("already_published");
  }

  if (isConvertible) {
    flags.push("ready_for_review");
  } else if (options.canConvert === false) {
    flags.push("not_convertible");
  }

  return {
    hasTitle,
    hasSummary,
    hasContent,
    hasSourceUrl,
    hasPublisher,
    hasValidPublishDate,
    hasTags,
    isDuplicate,
    isTooShort,
    isPrerelease,
    isAlreadyPublished,
    isConvertible,
    flags
  };
}

export function evaluateSourceQuality(
  source: ExternalSource,
  candidates: ImportedCandidate[],
  importRuns: ImportRun[] = []
): SourceQualityMetrics {
  const sourceCandidates = candidates.filter((candidate) => {
    const candidateSourceId = getCandidateSourceId(candidate);

    return candidateSourceId
      ? candidateSourceId === source.id
      : candidate.sourceName === source.name ||
          candidate.sourceUrl === source.url;
  });
  const sourceResults = importRuns.flatMap((run) =>
    run.sourceResults.filter((result) => result.sourceId === source.id)
  );
  const totalImportRuns =
    sourceResults.length > 0
      ? sourceResults.length
      : source.lastImportStatus === "never_run"
        ? 0
        : 1;
  const successfulImportRuns =
    sourceResults.length > 0
      ? sourceResults.filter((result) => result.status === "success").length
      : source.lastImportStatus === "success"
        ? 1
        : 0;
  const failedImportRuns =
    sourceResults.length > 0
      ? sourceResults.filter((result) => result.status === "failed").length
      : source.lastImportStatus === "failed"
        ? 1
        : 0;
  const totalCandidatesImported = sourceCandidates.length;
  const convertedCandidateCount = sourceCandidates.filter(
    (candidate) =>
      candidate.importStatus === "converted" ||
      Boolean(candidate.convertedTechnologyId)
  ).length;
  const rejectedCandidateCount = sourceCandidates.filter(
    (candidate) => candidate.importStatus === "rejected"
  ).length;
  const duplicateCandidateCount =
    sourceCandidates.filter(isCandidateDuplicate).length;
  const baseMetrics: Omit<SourceQualityMetrics, "qualityLevel"> = {
    successRate: calculateRate(successfulImportRuns, totalImportRuns),
    totalImportRuns,
    successfulImportRuns,
    failedImportRuns,
    totalCandidatesImported,
    convertedCandidateCount,
    rejectedCandidateCount,
    duplicateCandidateCount,
    duplicateRate: calculateRate(
      duplicateCandidateCount,
      totalCandidatesImported
    ),
    conversionRate: calculateRate(
      convertedCandidateCount,
      totalCandidatesImported
    ),
    rejectionRate: calculateRate(
      rejectedCandidateCount,
      totalCandidatesImported
    ),
    lastSuccessfulImportAt: source.lastSuccessfulImportAt,
    consecutiveFailureCount: source.consecutiveFailureCount ?? 0
  };

  return {
    ...baseMetrics,
    qualityLevel: inferSourceQualityLevel(source, baseMetrics)
  };
}

export function evaluateSourcesQuality(
  sources: ExternalSource[],
  candidates: ImportedCandidate[],
  importRuns: ImportRun[] = []
): Record<string, SourceQualityMetrics> {
  return Object.fromEntries(
    sources.map((source) => [
      source.id,
      evaluateSourceQuality(source, candidates, importRuns)
    ])
  );
}
