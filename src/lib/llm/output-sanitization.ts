// Shared, purpose-agnostic helpers for parsing and sanitizing LLM JSON output.
// Used by every output validator (editorial enrichment, technology comparison, ...)
// so the internal-field blacklist and truncation rules stay in one place.

export const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "delivery log",
  "DeliveryLog",
  "audit log",
  "AuditLog",
  "WorkflowEvent",
  "endpointUrl",
  "LLM_API_KEY",
  "WORKSPACE_ACCESS_TOKEN"
];

export function extractJsonText(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

export function hasInternalTerms(value: unknown): boolean {
  const serialized = JSON.stringify(value);

  return internalOnlyTerms.some((term) => serialized.includes(term));
}

export function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trim()}...`
    : normalized;
}

export function sanitizeString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = truncateText(value, maxLength);

  return normalized ? normalized : undefined;
}

export function sanitizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => sanitizeString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);

  return items.length > 0 ? items : undefined;
}
