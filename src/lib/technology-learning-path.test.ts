import { describe, expect, it } from "vitest";

import { validateTechnologyLearningPathLlmOutput } from "@/lib/llm/technology-learning-path-output";
import { generateOrGetTechnologyLearningPath } from "@/lib/technology-learning-path";

function validLearningPathJson(
  overrides: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    overview: "这条路径帮助你从背景概念出发建立判断力。",
    steps: ["先补齐背景概念", "再评估实际价值"],
    ...overrides
  });
}

describe("validateTechnologyLearningPathLlmOutput", () => {
  it("accepts well-formed JSON with overview and steps", () => {
    const result = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson()
    );

    expect(result.ok).toBe(true);
    expect(result.fields).toMatchObject({
      overview: "这条路径帮助你从背景概念出发建立判断力。",
      steps: ["先补齐背景概念", "再评估实际价值"]
    });
  });

  it("rejects output that is not valid JSON", () => {
    const result = validateTechnologyLearningPathLlmOutput("not json at all");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid JSON/i);
  });

  it("rejects output missing the overview field", () => {
    const result = validateTechnologyLearningPathLlmOutput(
      JSON.stringify({ steps: ["x"] })
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/overview/i);
  });

  it("rejects output with no steps", () => {
    const missingSteps = validateTechnologyLearningPathLlmOutput(
      JSON.stringify({ overview: "总览" })
    );
    const emptySteps = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson({ steps: [] })
    );

    expect(missingSteps.ok).toBe(false);
    expect(missingSteps.error).toMatch(/steps/i);
    expect(emptySteps.ok).toBe(false);
    expect(emptySteps.error).toMatch(/steps/i);
  });

  it("rejects output containing internal-only terms", () => {
    const result = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson({ overview: "contains LLM_API_KEY somewhere" })
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/internal-only/i);
  });

  it("treats checkpoints as optional and keeps them when provided", () => {
    const withoutCheckpoints = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson()
    );
    const withCheckpoints = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson({ checkpoints: ["能说清核心问题"] })
    );

    expect(withoutCheckpoints.ok).toBe(true);
    expect(
      (withoutCheckpoints.fields as { checkpoints?: string[] }).checkpoints
    ).toBeUndefined();
    expect(withCheckpoints.ok).toBe(true);
    expect(withCheckpoints.fields).toMatchObject({
      checkpoints: ["能说清核心问题"]
    });
  });

  it("drops unsupported top-level fields and reports a warning instead of failing", () => {
    const result = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson({ providerName: "should-be-dropped" })
    );

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("providerName"))
    ).toBe(true);
    expect(JSON.stringify(result.fields)).not.toContain("should-be-dropped");
  });

  it("caps steps at the max item count", () => {
    const manyItems = Array.from({ length: 10 }, (_, index) => `step ${index}`);
    const result = validateTechnologyLearningPathLlmOutput(
      validLearningPathJson({ steps: manyItems })
    );

    expect(result.ok).toBe(true);
    expect(
      (result.fields as { steps: string[] }).steps.length
    ).toBeLessThanOrEqual(6);
  });
});

describe("generateOrGetTechnologyLearningPath input validation", () => {
  it("returns not_found when the id is not in getAllTechnologies()", async () => {
    const outcome = await generateOrGetTechnologyLearningPath("does-not-exist");

    expect("error" in outcome && outcome.error.code).toBe("not_found");
  });
});
