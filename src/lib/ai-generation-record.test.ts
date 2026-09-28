import { describe, expect, it } from "vitest";

import {
  buildAiGenerationMetadata,
  normalizeAiGenerationMetadata
} from "@/lib/ai-generation-record";
import { parseLlmJsonObject } from "@/lib/llm/output-sanitization";

describe("normalizeAiGenerationMetadata", () => {
  it("keeps a well-formed stored record as it is", () => {
    const stored = {
      generationMode: "llm_assisted",
      providerName: "deepseek",
      modelName: "deepseek-chat",
      promptVersionId: "p1",
      promptVersion: "v1",
      outputValidationStatus: "warning",
      outputValidationWarnings: ["Ignored unsupported LLM output field: x."],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z"
    };

    expect(normalizeAiGenerationMetadata(stored)).toEqual({
      ...stored,
      generationError: undefined
    });
  });

  it("reads a malformed record as a failed mock entry, so it gets regenerated", () => {
    const metadata = normalizeAiGenerationMetadata({
      generationMode: "gpt",
      outputValidationStatus: "great",
      providerName: 42
    });

    expect(metadata.generationMode).toBe("mock_llm");
    expect(metadata.outputValidationStatus).toBe("failed");
    expect(metadata.providerName).toBeUndefined();
    expect(metadata.outputValidationWarnings).toEqual([]);
  });
});

describe("buildAiGenerationMetadata", () => {
  const base = { generationMode: "mock_llm" as const };

  it("derives valid / warning / failed from the validation result", () => {
    expect(
      buildAiGenerationMetadata({
        ...base,
        validation: { ok: true, warnings: [] }
      }).outputValidationStatus
    ).toBe("valid");
    expect(
      buildAiGenerationMetadata({
        ...base,
        validation: { ok: true, warnings: ["w"] }
      }).outputValidationStatus
    ).toBe("warning");

    const failed = buildAiGenerationMetadata({
      ...base,
      validation: { ok: false, warnings: [], error: "bad" }
    });

    expect(failed.outputValidationStatus).toBe("failed");
    expect(failed.generationError).toBe("bad");
  });

  it("keeps the cached creation time when regenerating", () => {
    const metadata = buildAiGenerationMetadata({
      ...base,
      validation: { ok: true, warnings: [] },
      createdAt: "2026-01-01T00:00:00.000Z"
    });

    expect(metadata.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(metadata.updatedAt > metadata.createdAt).toBe(true);
  });
});

describe("parseLlmJsonObject", () => {
  const allowed = new Set(["overview"]);

  it("returns the object and warns about fields it will ignore", () => {
    expect(
      parseLlmJsonObject('```json\n{"overview":"a","extra":1}\n```', allowed)
    ).toEqual({
      ok: true,
      record: { overview: "a", extra: 1 },
      warnings: ["Ignored unsupported LLM output field: extra."]
    });
  });

  it("refuses non-JSON, non-objects and internal-only terms", () => {
    expect(parseLlmJsonObject("not json", allowed).ok).toBe(false);
    expect(parseLlmJsonObject("[1,2]", allowed).ok).toBe(false);
    expect(
      parseLlmJsonObject('{"overview":"see rawPayload"}', allowed).ok
    ).toBe(false);
  });
});
