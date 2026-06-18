import type {
  IntelligenceStatus,
  LocalizedText,
  ReadingDifficulty
} from "@/types/content";

// Pure text / field normalization helpers used when sanitizing imported
// candidates and building/updating technology workspace records. No I/O.

export function normalizeReadableText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "[object Object]") {
    return undefined;
  }

  return trimmed;
}

export function stripMarkup(value: string | undefined): string | undefined {
  const trimmed = normalizeReadableText(value);

  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPayloadText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return stripMarkup(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record["#text"] === "string") {
      return stripMarkup(record["#text"]);
    }
  }

  return undefined;
}

export function trimReadableText(value: string | undefined, maxLength: number): string | undefined {
  const normalizedValue = normalizeReadableText(value);

  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength - 3).trimEnd()}...`;
}

export function normalizeOptionalField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

export function normalizeRequiredField(
  value: string | undefined,
  fallbackValue: string
): string {
  return normalizeOptionalField(value) ?? fallbackValue;
}

export function normalizeEditableText(value: string | undefined, fallbackValue: string): string {
  return value === undefined ? fallbackValue : value.trim();
}

export function normalizeStringList(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

export function normalizeStoredStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeStringList(
    value.filter((item): item is string => typeof item === "string")
  ) ?? [];
}

export function normalizeStringMap(
  value: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, mapValue]) => [key.trim(), mapValue.trim()] as const)
      .filter(([key, mapValue]) => key.length > 0 && mapValue.length > 0)
  );
}

export function normalizeStoredStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const stringEntries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .reduce<Record<string, string>>((result, [key, mapValue]) => {
      result[key] = mapValue;
      return result;
    }, {});

  return normalizeStringMap(stringEntries) ?? {};
}

export function normalizeReadingDifficulty(value: unknown): ReadingDifficulty | undefined {
  return value === "beginner" || value === "intermediate" || value === "advanced"
    ? value
    : undefined;
}

export function normalizeIntelligenceStatus(value: unknown): IntelligenceStatus {
  return value === "draft" || value === "reviewed" || value === "needs_enrichment"
    ? value
    : "needs_enrichment";
}

export function normalizeSlug(value: string | undefined, fallbackTitle: string): string {
  const slugSource = normalizeOptionalField(value) ?? fallbackTitle;
  const normalizedSlug = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedSlug || "technology-draft";
}

export function mergeLocalizedText(
  existingValue: LocalizedText,
  nextValue: LocalizedText | undefined
): LocalizedText {
  if (!nextValue) {
    return existingValue;
  }

  return {
    original: normalizeRequiredField(nextValue.original, existingValue.original),
    zh: normalizeOptionalField(nextValue.zh),
    en: normalizeOptionalField(nextValue.en)
  };
}
