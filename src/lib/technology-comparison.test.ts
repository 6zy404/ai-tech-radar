import { describe, expect, it } from "vitest";

import { validateTechnologyComparisonLlmOutput } from "@/lib/llm/technology-comparison-output";
import { getComparisonPairKey } from "@/lib/technology-comparison-store";
import { generateOrGetTechnologyComparison } from "@/lib/technology-comparison";

describe("getComparisonPairKey", () => {
  it("produces the same key regardless of argument order", () => {
    expect(getComparisonPairKey("tech-a", "tech-b")).toBe(
      getComparisonPairKey("tech-b", "tech-a")
    );
  });

  it("joins ids with the :: separator, sorted", () => {
    expect(getComparisonPairKey("tech-b", "tech-a")).toBe("tech-a::tech-b");
  });
});

function validComparisonJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    similarities: ["都解决相邻问题"],
    differences: ["适用场景不同"],
    whenToPreferA: "当团队需要 A 所解决的场景时。",
    whenToPreferB: "当团队需要 B 所解决的场景时。",
    ...overrides
  });
}

describe("validateTechnologyComparisonLlmOutput", () => {
  it("accepts well-formed JSON with all required fields", () => {
    const result = validateTechnologyComparisonLlmOutput(validComparisonJson());

    expect(result.ok).toBe(true);
    expect(result.fields).toMatchObject({
      similarities: ["都解决相邻问题"],
      differences: ["适用场景不同"]
    });
  });

  it("rejects output that is not valid JSON", () => {
    const result = validateTechnologyComparisonLlmOutput("not json at all");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid JSON/i);
  });

  it("rejects output missing whenToPreferA or whenToPreferB", () => {
    const missingA = validateTechnologyComparisonLlmOutput(
      JSON.stringify({
        similarities: ["x"],
        differences: ["y"],
        whenToPreferB: "when B"
      })
    );
    const missingB = validateTechnologyComparisonLlmOutput(
      JSON.stringify({
        similarities: ["x"],
        differences: ["y"],
        whenToPreferA: "when A"
      })
    );

    expect(missingA.ok).toBe(false);
    expect(missingB.ok).toBe(false);
  });

  it("rejects output containing internal-only terms", () => {
    const result = validateTechnologyComparisonLlmOutput(
      JSON.stringify({
        similarities: ["contains LLM_API_KEY somewhere"],
        differences: [],
        whenToPreferA: "a",
        whenToPreferB: "b"
      })
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/internal-only/i);
  });

  it("truncates over-length strings instead of failing", () => {
    const longText = "很长".repeat(300);
    const result = validateTechnologyComparisonLlmOutput(
      validComparisonJson({ whenToPreferA: longText })
    );

    expect(result.ok).toBe(true);
    // truncateText appends "..." without shrinking the slice to make room for it,
    // so the real cap is maxLength + 2, not maxLength exactly (pre-existing
    // behavior inherited verbatim from editorial-enrichment-output.ts).
    expect(
      (result.fields as { whenToPreferA: string }).whenToPreferA.length
    ).toBeLessThanOrEqual(422);
    expect(
      (result.fields as { whenToPreferA: string }).whenToPreferA.length
    ).toBeLessThan(longText.length);
  });

  it("drops unsupported top-level fields and reports a warning instead of failing", () => {
    const result = validateTechnologyComparisonLlmOutput(
      validComparisonJson({ providerName: "should-be-dropped" })
    );

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("providerName"))
    ).toBe(true);
    expect(JSON.stringify(result.fields)).not.toContain("should-be-dropped");
  });

  it("caps array fields at the max item count", () => {
    const manyItems = Array.from(
      { length: 10 },
      (_, index) => `point ${index}`
    );
    const result = validateTechnologyComparisonLlmOutput(
      validComparisonJson({ similarities: manyItems })
    );

    expect(result.ok).toBe(true);
    expect(
      (result.fields as { similarities: string[] }).similarities.length
    ).toBeLessThanOrEqual(6);
  });

  it("treats sharedConsiderations as optional", () => {
    const result = validateTechnologyComparisonLlmOutput(validComparisonJson());

    expect(result.ok).toBe(true);
    expect(
      (result.fields as { sharedConsiderations?: string[] })
        .sharedConsiderations
    ).toBeUndefined();
  });
});

describe("generateOrGetTechnologyComparison input validation", () => {
  it("returns invalid_pair when both ids are identical", async () => {
    const outcome = await generateOrGetTechnologyComparison(
      "tech-mcp",
      "tech-mcp"
    );

    expect("error" in outcome && outcome.error.code).toBe("invalid_pair");
  });

  it("returns not_found when an id is not in getAllTechnologies()", async () => {
    const outcome = await generateOrGetTechnologyComparison(
      "does-not-exist-a",
      "does-not-exist-b"
    );

    expect("error" in outcome && outcome.error.code).toBe("not_found");
  });
});
