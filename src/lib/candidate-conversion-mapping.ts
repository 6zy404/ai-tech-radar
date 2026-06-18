import { topicTags } from "@/data/tags";
import type {
  CandidateNormalizedType,
  CandidateSourceReference,
  ImportedCandidate,
  PublisherType,
  TechnologyType
} from "@/types/content";

// Pure mapping helpers that translate an imported candidate into the fields of
// a technology workspace draft (type, publisher, tags, localized text, source
// reference). No I/O or persisted state.

export function normalizeTechnologyType(
  normalizedType: CandidateNormalizedType
): TechnologyType {
  if (normalizedType === "unknown") {
    return "tool";
  }

  return normalizedType;
}

export function inferPublisherType(candidate: ImportedCandidate): PublisherType {
  const haystack = `${candidate.publisherName} ${candidate.sourceName}`.toLowerCase();

  if (/(github|community|open source|maintainer|modelcontextprotocol)/.test(haystack)) {
    return "open-source-community";
  }

  if (/(anthropic|hugging face|research|lab)/.test(haystack)) {
    return "research-lab";
  }

  if (/(openai|cloudflare|google|microsoft|meta|amazon)/.test(haystack)) {
    return "big-tech";
  }

  if (/(review|digest|technology review|media|journal)/.test(haystack)) {
    return "media";
  }

  return "startup";
}

export function mapCandidateTagsToTopicTagIds(candidate: ImportedCandidate): string[] {
  const haystack = `${candidate.originalTitle} ${candidate.originalSummary ?? ""} ${
    candidate.originalContent ?? ""
  } ${candidate.tags.join(" ")}`.toLowerCase();
  const matchedTagIds = new Set<string>();

  for (const tag of topicTags) {
    if (tag.id === "tag-ai-agents" && /(agent|tool use|assistant|sdk)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-retrieval" && /(retrieval|search|rag|grounding)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-multimodal" && /(vision|browser|voice|multimodal|image)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-workflow" && /(workflow|rollout|orchestration|automation|release)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-on-device" && /(local|on-device|edge)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-observability" && /(trace|evaluation|observability|monitor|benchmark)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-knowledge-graph" && /(graph|knowledge)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }

    if (tag.id === "tag-product-strategy" && /(product|platform|team|operator|strategy)/.test(haystack)) {
      matchedTagIds.add(tag.id);
    }
  }

  return Array.from(matchedTagIds);
}

export function buildDraftText(
  originalValue: string,
  originalLanguage: ImportedCandidate["originalLanguage"]
): { original: string; zh?: string; en?: string } {
  return {
    original: originalValue,
    zh: originalLanguage === "zh" ? originalValue : undefined,
    en: originalLanguage === "en" ? originalValue : undefined
  };
}

export function buildDraftContent(candidate: ImportedCandidate): string {
  if (candidate.originalContent) {
    return candidate.originalContent;
  }

  if (candidate.originalSummary) {
    return `${candidate.originalSummary}\n\nOriginal full content was not captured during import. Use the source link for the complete text.`;
  }

  return "Imported candidate without captured body content. Use the source link for the full original text.";
}

export function buildCandidateSourceReference(
  candidate: ImportedCandidate
): CandidateSourceReference {
  return {
    candidateId: candidate.id,
    sourceType: candidate.sourceType,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    publisherName: candidate.publisherName,
    publishDate: candidate.publishDate
  };
}
