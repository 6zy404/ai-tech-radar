import { describe, expect, it } from "vitest";

import { validateTechnologyExplanationLlmOutput } from "@/lib/llm/technology-explanation-output";
import { getExplanationCacheKey } from "@/lib/technology-explanation-store";
import {
  generateOrGetTechnologyExplanation,
  isTechnologyExplanationAudienceLevel
} from "@/lib/technology-explanation";
import type { TechnologyExplanationAudienceLevel } from "@/types/content";

describe("getExplanationCacheKey", () => {
  it("keys the cache by technology id and audience level", () => {
    expect(getExplanationCacheKey("tech-mcp", "beginner")).toBe(
      "tech-mcp::beginner"
    );
  });

  it("produces distinct keys for distinct levels of the same technology", () => {
    expect(getExplanationCacheKey("tech-mcp", "beginner")).not.toBe(
      getExplanationCacheKey("tech-mcp", "advanced")
    );
  });
});

describe("isTechnologyExplanationAudienceLevel", () => {
  it("accepts the three supported levels", () => {
    for (const level of ["beginner", "intermediate", "advanced"]) {
      expect(isTechnologyExplanationAudienceLevel(level)).toBe(true);
    }
  });

  it("rejects unsupported values", () => {
    for (const value of ["expert", "", 3, null, undefined]) {
      expect(isTechnologyExplanationAudienceLevel(value)).toBe(false);
    }
  });
});

function validExplanationJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    explanation: "这个信号解决了一个真实的工程问题。",
    keyPoints: ["先弄清它解决什么问题"],
    ...overrides
  });
}

describe("validateTechnologyExplanationLlmOutput", () => {
  it("accepts well-formed JSON with the required explanation field", () => {
    const result = validateTechnologyExplanationLlmOutput(
      validExplanationJson()
    );

    expect(result.ok).toBe(true);
    expect(result.fields).toMatchObject({
      explanation: "这个信号解决了一个真实的工程问题。",
      keyPoints: ["先弄清它解决什么问题"]
    });
  });

  it("rejects output that is not valid JSON", () => {
    const result = validateTechnologyExplanationLlmOutput("not json at all");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid JSON/i);
  });

  it("rejects output missing the explanation field", () => {
    const result = validateTechnologyExplanationLlmOutput(
      JSON.stringify({ keyPoints: ["x"] })
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/explanation/i);
  });

  it("rejects output containing internal-only terms", () => {
    const result = validateTechnologyExplanationLlmOutput(
      validExplanationJson({
        explanation: "contains LLM_API_KEY somewhere"
      })
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/internal-only/i);
  });

  it("treats analogy and nextSteps as optional", () => {
    const result = validateTechnologyExplanationLlmOutput(
      validExplanationJson()
    );

    expect(result.ok).toBe(true);
    expect((result.fields as { analogy?: string }).analogy).toBeUndefined();
    expect(
      (result.fields as { nextSteps?: string[] }).nextSteps
    ).toBeUndefined();
  });

  it("keeps analogy and nextSteps when provided", () => {
    const result = validateTechnologyExplanationLlmOutput(
      validExplanationJson({
        analogy: "就像换上更合适的零件。",
        nextSteps: ["阅读原始来源"]
      })
    );

    expect(result.ok).toBe(true);
    expect(result.fields).toMatchObject({
      analogy: "就像换上更合适的零件。",
      nextSteps: ["阅读原始来源"]
    });
  });

  it("drops unsupported top-level fields and reports a warning instead of failing", () => {
    const result = validateTechnologyExplanationLlmOutput(
      validExplanationJson({ providerName: "should-be-dropped" })
    );

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("providerName"))
    ).toBe(true);
    expect(JSON.stringify(result.fields)).not.toContain("should-be-dropped");
  });

  it("caps keyPoints at the max item count", () => {
    const manyItems = Array.from(
      { length: 10 },
      (_, index) => `point ${index}`
    );
    const result = validateTechnologyExplanationLlmOutput(
      validExplanationJson({ keyPoints: manyItems })
    );

    expect(result.ok).toBe(true);
    expect(
      (result.fields as { keyPoints: string[] }).keyPoints.length
    ).toBeLessThanOrEqual(5);
  });
});

describe("generateOrGetTechnologyExplanation input validation", () => {
  it("returns invalid_level for an unsupported audience level", async () => {
    const outcome = await generateOrGetTechnologyExplanation(
      "tech-mcp",
      "expert" as TechnologyExplanationAudienceLevel
    );

    expect("error" in outcome && outcome.error.code).toBe("invalid_level");
  });

  it("returns not_found when the id is not in getAllTechnologies()", async () => {
    const outcome = await generateOrGetTechnologyExplanation(
      "does-not-exist",
      "intermediate"
    );

    expect("error" in outcome && outcome.error.code).toBe("not_found");
  });
});
