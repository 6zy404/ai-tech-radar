// The generation metadata every public AI cache record carries — comparison,
// explanation and learning path — after its own key and `fields`. All of it
// is internal-only: the public mappers (`toPublic*Result`) never copy it out.
// Each of the three stores and generators used to spell these ten fields out
// on its own; this is the one place they are read back from disk and built
// from a provider response.

export interface AiGenerationMetadata {
  generationMode: "mock_llm" | "llm_assisted";
  providerName?: string;
  modelName?: string;
  promptVersionId?: string;
  promptVersion?: string;
  outputValidationStatus: "valid" | "warning" | "failed";
  outputValidationWarnings: string[];
  generationError?: string;
  createdAt: string;
  updatedAt: string;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Reads the metadata back from an untrusted stored record. Anything
// malformed falls to the safe side: `mock_llm`, and `failed`, which makes the
// generator treat the cache entry as absent and regenerate it.
export function normalizeAiGenerationMetadata(
  record: Record<string, unknown>
): AiGenerationMetadata {
  const now = new Date().toISOString();

  return {
    generationMode:
      record.generationMode === "llm_assisted" ? "llm_assisted" : "mock_llm",
    providerName: optionalString(record.providerName),
    modelName: optionalString(record.modelName),
    promptVersionId: optionalString(record.promptVersionId),
    promptVersion: optionalString(record.promptVersion),
    outputValidationStatus:
      record.outputValidationStatus === "valid" ||
      record.outputValidationStatus === "warning" ||
      record.outputValidationStatus === "failed"
        ? record.outputValidationStatus
        : "failed",
    outputValidationWarnings: Array.isArray(record.outputValidationWarnings)
      ? (record.outputValidationWarnings as string[])
      : [],
    generationError: optionalString(record.generationError),
    createdAt: optionalString(record.createdAt) ?? now,
    updatedAt: optionalString(record.updatedAt) ?? now
  };
}

// Whether a cached record may be served instead of generating again. A failed
// record never is. Nor is a mock record once a real model is configured: the
// cache keeps a result forever, so a template answer written while no key was
// set would otherwise reach readers indefinitely (four did, from July). The
// reverse is deliberate: a mock provider — a dev server without a key — never
// discards a real model's answer.
export function isReusableCachedAiRecord(
  cached:
    | Pick<AiGenerationMetadata, "generationMode" | "outputValidationStatus">
    | undefined,
  currentMode: AiGenerationMetadata["generationMode"]
): boolean {
  if (!cached || cached.outputValidationStatus === "failed") {
    return false;
  }

  return !(
    cached.generationMode === "mock_llm" && currentMode === "llm_assisted"
  );
}

export interface AiGenerationInput {
  generationMode: AiGenerationMetadata["generationMode"];
  providerName?: string;
  modelName?: string;
  promptVersionId?: string;
  promptVersion?: string;
  validation: { ok: boolean; warnings: string[]; error?: string };
  // The cached record's creation time when this regenerates an entry.
  createdAt?: string;
}

export function buildAiGenerationMetadata(
  input: AiGenerationInput
): AiGenerationMetadata {
  const now = new Date().toISOString();
  const { validation } = input;

  return {
    generationMode: input.generationMode,
    providerName: input.providerName,
    modelName: input.modelName,
    promptVersionId: input.promptVersionId,
    promptVersion: input.promptVersion,
    outputValidationStatus: validation.ok
      ? validation.warnings.length > 0
        ? "warning"
        : "valid"
      : "failed",
    outputValidationWarnings: validation.warnings,
    generationError: validation.ok ? undefined : validation.error,
    createdAt: input.createdAt ?? now,
    updatedAt: now
  };
}
