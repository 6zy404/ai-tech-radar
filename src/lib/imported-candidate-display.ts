import type {
  CandidateImportStatus,
  CandidateNormalizedType,
  DuplicateReason,
  ImportedCandidate,
  ImportedSourceType
} from "@/types/content";

export function getImportedCandidateSourceTypeLabel(
  sourceType: ImportedSourceType
): string {
  const labels: Record<ImportedSourceType, string> = {
    "rss-feed": "RSS / Atom",
    "github-release": "GitHub Release",
    "official-blog": "Official Blog"
  };

  return labels[sourceType];
}

export function getImportedCandidateStatusLabel(
  status: CandidateImportStatus
): string {
  const labels: Record<CandidateImportStatus, string> = {
    new: "New",
    reviewed: "Reviewed",
    converted: "Converted",
    rejected: "Rejected"
  };

  return labels[status];
}

export function getImportedCandidateNormalizedTypeLabel(
  normalizedType: CandidateNormalizedType
): string {
  if (normalizedType === "unknown") {
    return "Unknown";
  }

  return normalizedType
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function getImportedCandidatePreviewText(
  candidate: ImportedCandidate
): string {
  return candidate.originalSummary ?? candidate.originalContent ?? "No summary available.";
}

export function getImportedCandidateSearchText(
  candidate: ImportedCandidate
): string {
  return [
    candidate.originalTitle,
    candidate.originalSummary,
    candidate.originalContent,
    candidate.sourceName,
    candidate.publisherName,
    candidate.normalizedType,
    candidate.sourceType,
    candidate.importStatus,
    ...candidate.tags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getImportedCandidateDuplicateLabel(candidate: ImportedCandidate): string {
  const duplicateCount = candidate.relatedCandidateIds.length;

  if (duplicateCount === 0) {
    return "No duplicate hint";
  }

  if (duplicateCount === 1) {
    return "1 possible duplicate";
  }

  return `${duplicateCount} possible duplicates`;
}

export function getDuplicateReasonLabel(reason: DuplicateReason): string {
  const labels: Record<DuplicateReason, string> = {
    same_source_url: "Same source URL",
    similar_title: "Similar title",
    same_publisher_near_date: "Same publisher near date",
    same_repo_release_family: "Same GitHub repo release family",
    same_canonical_url: "Same canonical link"
  };

  return labels[reason];
}
