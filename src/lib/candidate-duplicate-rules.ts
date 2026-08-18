import type { DuplicateReason, ImportedCandidate } from "@/types/content";

// Pure duplicate-detection rules and identity helpers extracted from
// candidate-workflow.ts. No disk or store access; safe to unit test directly.

export function dedupeDuplicateReasons(
  reasons: DuplicateReason[]
): DuplicateReason[] {
  return Array.from(new Set(reasons));
}

export function normalizeUrlForComparison(url: string): string {
  try {
    const parsedUrl = new URL(url);

    parsedUrl.hash = "";
    parsedUrl.searchParams.delete("utm_source");
    parsedUrl.searchParams.delete("utm_medium");
    parsedUrl.searchParams.delete("utm_campaign");

    return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
}

function getRawPayloadRecord(
  candidate: ImportedCandidate
): Record<string, unknown> {
  return candidate.rawPayload && typeof candidate.rawPayload === "object"
    ? (candidate.rawPayload as Record<string, unknown>)
    : {};
}

function getNestedRecord(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const nestedValue = value[key];

  return nestedValue && typeof nestedValue === "object"
    ? (nestedValue as Record<string, unknown>)
    : undefined;
}

function getRecordString(
  record: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getCanonicalUrl(candidate: ImportedCandidate): string | undefined {
  const rawPayload = getRawPayloadRecord(candidate);
  const entry = getNestedRecord(rawPayload, "entry");
  const item = getNestedRecord(rawPayload, "item");
  const release = getNestedRecord(rawPayload, "release");
  const listingPreview = getNestedRecord(rawPayload, "listingPreview");
  const canonicalUrl =
    getRecordString(rawPayload, [
      "canonicalUrl",
      "canonical_url",
      "canonical",
      "link",
      "url",
      "html_url"
    ]) ??
    getRecordString(entry, [
      "canonicalUrl",
      "canonical_url",
      "link",
      "url",
      "id"
    ]) ??
    getRecordString(item, [
      "canonicalUrl",
      "canonical_url",
      "link",
      "url",
      "guid"
    ]) ??
    getRecordString(release, ["html_url", "url"]) ??
    getRecordString(listingPreview, ["url", "href"]);

  return canonicalUrl ? normalizeUrlForComparison(canonicalUrl) : undefined;
}

function getGitHubRepoKey(candidate: ImportedCandidate): string | undefined {
  const rawPayload = getRawPayloadRecord(candidate);
  const release = getNestedRecord(rawPayload, "release");
  const repository = getNestedRecord(rawPayload, "repository");
  const fullName = getRecordString(repository, ["full_name"]);

  if (fullName) {
    return fullName.toLowerCase();
  }

  const releaseUrl = getRecordString(release, ["html_url", "url"]);
  const possibleUrls = [candidate.sourceUrl, releaseUrl].filter(
    (value): value is string => Boolean(value)
  );

  for (const possibleUrl of possibleUrls) {
    try {
      const parsedUrl = new URL(possibleUrl);
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

      if (
        parsedUrl.hostname === "api.github.com" &&
        pathParts[0] === "repos" &&
        pathParts.length >= 3
      ) {
        return `${pathParts[1]}/${pathParts[2]}`.toLowerCase();
      }

      if (parsedUrl.hostname.endsWith("github.com") && pathParts.length >= 2) {
        return `${pathParts[0]}/${pathParts[1]}`.toLowerCase();
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

export function normalizeTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\b(the|a|an|for|and|of|to|in|on|with|new)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTitleTokenSet(title: string): Set<string> {
  return new Set(
    normalizeTitleForComparison(title)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

/**
 * Whether a title carries enough latin content for its normalized form to mean
 * anything. `normalizeTitleForComparison` strips every non-latin character, so
 * an all-Chinese title collapses to whatever latin fragments it happens to
 * contain — and on a Chinese-language AI feed that is almost always the bare
 * string `ai`. Three unrelated candidates collided exactly that way on
 * 2026-08-18 (a Fields medallist on LLM mathematics, a HarmonyOS piece, and an
 * interview), which silently blocked the non-primary ones from converting at
 * all.
 *
 * The threshold is the tokenizer's own: if nothing survives that would survive
 * token comparison, an identical normalization is not evidence of anything.
 */
function hasComparableTitleTokens(title: string): boolean {
  return buildTitleTokenSet(title).size > 0;
}

export function calculateTokenSimilarity(
  leftTitle: string,
  rightTitle: string
): number {
  const leftTokens = buildTitleTokenSet(leftTitle);
  const rightTokens = buildTitleTokenSet(rightTitle);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlapCount = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount / Math.max(leftTokens.size, rightTokens.size);
}

function getDayDistance(leftDate: string, rightDate: string): number {
  const leftTime = new Date(leftDate).valueOf();
  const rightTime = new Date(rightDate).valueOf();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(leftTime - rightTime) / (1000 * 60 * 60 * 24);
}

export function getPairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("__");
}

export function buildStableDuplicateGroupId(candidateIds: string[]): string {
  const normalizedValue = candidateIds.slice().sort().join("|");
  let hash = 0;

  for (let index = 0; index < normalizedValue.length; index += 1) {
    hash = (hash * 31 + normalizedValue.charCodeAt(index)) >>> 0;
  }

  return `dup-${hash.toString(36)}`;
}

function getCandidatePrimaryScore(candidate: ImportedCandidate): number {
  return [
    candidate.originalContent?.length ?? 0,
    candidate.originalSummary?.length ?? 0,
    candidate.sourceUrl ? 120 : 0,
    candidate.publisherName ? 80 : 0,
    candidate.tags.length * 12
  ].reduce((score, value) => score + value, 0);
}

export function chooseDefaultPrimaryCandidate(
  candidates: ImportedCandidate[]
): string {
  return candidates.slice().sort((left, right) => {
    const scoreDiff =
      getCandidatePrimaryScore(right) - getCandidatePrimaryScore(left);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return right.publishDate.localeCompare(left.publishDate);
  })[0].id;
}

export function getDuplicateReasons(
  left: ImportedCandidate,
  right: ImportedCandidate
): DuplicateReason[] {
  const reasons: DuplicateReason[] = [];
  const titleSimilarity = calculateTokenSimilarity(
    left.originalTitle,
    right.originalTitle
  );
  const samePublisher =
    left.publisherName.trim().toLowerCase() ===
    right.publisherName.trim().toLowerCase();
  const sameUrl =
    normalizeUrlForComparison(left.sourceUrl) ===
    normalizeUrlForComparison(right.sourceUrl);
  const leftCanonicalUrl = getCanonicalUrl(left);
  const rightCanonicalUrl = getCanonicalUrl(right);
  const sameCanonicalUrl =
    Boolean(leftCanonicalUrl) &&
    Boolean(rightCanonicalUrl) &&
    leftCanonicalUrl === rightCanonicalUrl;
  const sameNormalizedTitle =
    normalizeTitleForComparison(left.originalTitle) ===
    normalizeTitleForComparison(right.originalTitle);
  const sameRepoReleaseFamily =
    left.sourceType === "github-release" &&
    right.sourceType === "github-release" &&
    Boolean(getGitHubRepoKey(left)) &&
    getGitHubRepoKey(left) === getGitHubRepoKey(right);
  const dayDistance = getDayDistance(left.publishDate, right.publishDate);

  if (sameUrl) {
    reasons.push("same_source_url");
  }

  if (sameCanonicalUrl) {
    reasons.push("same_canonical_url");
  }

  if (
    (sameNormalizedTitle && hasComparableTitleTokens(left.originalTitle)) ||
    titleSimilarity >= 0.82
  ) {
    reasons.push("similar_title");
  }

  if (samePublisher && dayDistance <= 10 && titleSimilarity >= 0.68) {
    reasons.push("same_publisher_near_date");
  }

  if (sameRepoReleaseFamily && dayDistance <= 45 && titleSimilarity >= 0.35) {
    reasons.push("same_repo_release_family");
  }

  return dedupeDuplicateReasons(reasons);
}
